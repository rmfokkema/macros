(async function(){
	class CssPropertyMatcher{
		constructor(propertyName, referent){
			this.propertyName = propertyName;
			this.propertyNameRegExp = new RegExp(`^${propertyName.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[\\S]*?')}$`);
			this.referent = referent;
		}
		*getMatchingPropertyNames(declaration){
			for(var i = 0; i < declaration.length; i++){
				if(declaration[i].match(this.propertyNameRegExp)){
					yield declaration[i];
				}
			}
		}
		declarationContainsProperty(declaration){
			for(var i = 0; i < declaration.length; i++){
				if(declaration[i] === this.propertyName){
					return true;
				}
			}
			return false;
		}
		matchesDeclaration(declaration){
			for(var matchingPropertyName of this.getMatchingPropertyNames(declaration)){
				if(this.matchesDeclarationValue(declaration.getPropertyValue(matchingPropertyName))){
					return true;
				}
			}
			return false;
		}
	}
	class EqualsMatcher extends CssPropertyMatcher{
		matchesDeclarationValue(declarationValue){
			return declarationValue === this.referent;
		}
		toString(){
			return `${this.propertyName} === ${this.referent}`
		}
	}
	class ComparingMatcher extends CssPropertyMatcher{
		constructor(propertyName, referent){
			super(propertyName, referent);
			this.referentValue = this.parseValue(referent);
			this.referentValueIsNaN = isNaN(this.referentValue);
		}
		parseValue(value){
			return parseFloat(value);
		}
		matchesDeclarationValue(declarationValue){
			if(this.referentValueIsNaN){
				return false;
			}
			var actualValue = this.parseValue(declarationValue);
			return !isNaN(actualValue) && this.matchesActualValue(actualValue);
		}
	}
	class LessThanMatcher extends ComparingMatcher{
		matchesActualValue(actualValue){
			return actualValue < this.referentValue;
		}
		toString(){
			return `${this.propertyName} < ${this.referent}`
		}
	}
	class GreaterThanMatcher extends ComparingMatcher{
		matchesActualValue(actualValue){
			return actualValue > this.referentValue;
		}
		toString(){
			return `${this.propertyName} > ${this.referent}`
		}
	}
	class SelectorQuery{
		constructor(restrictions){
			this.matchers = restrictions.map((r) => this.createMatcher(r));
		}
		createMatcher(restriction){
			switch(restriction.comparison){
				case "eq": return new EqualsMatcher(restriction.property, restriction.value);
				case "lt": return new LessThanMatcher(restriction.property, restriction.value);
				case "gt": return new GreaterThanMatcher(restriction.property, restriction.value);
			}
		}
		matchesDeclaration(declaration){
			for(var matcher of this.matchers){
				if(!matcher.matchesDeclaration(declaration)){
					return false;
				}
			}
			return true;
		}
		toString(){
			return this.matchers.map(m => m.toString()).join(' && ');
		}
	}

	function* findCssRulesInSheet(cssStyleSheet){
		try{
			var rules = cssStyleSheet.cssRules;
			for(var i = 0; i < rules.length; i++){
				var rule = rules[i];
				if(rule.type !== CSSRule.STYLE_RULE){
					continue;
				}
				yield rule;
			}
		}catch(e){}
	}
	function* findCssRules(){
		var sheets = document.styleSheets;
		for(var i = 0; i < sheets.length; i++){
			var sheet = sheets[i];
			if(sheet.disabled || sheet.type !== "text/css"){
				continue;
			}
			yield* findCssRulesInSheet(sheet);
		}
	}
	function* findMatches(query){
		for(var rule of findCssRules()){
			if(!query.matchesDeclaration(rule.style)){
				continue;
			}
			var nodes = document.querySelectorAll(rule.selectorText);
			if(nodes.length === 0){
				continue;
			}
			yield {
				cssText: prettifyCssText(rule.cssText),
				nodes: nodes
			}
		}
	}
	function summarizeNode(node){
		var nodeName = node.nodeName.toLowerCase();
		var classAttributeValue = node.getAttribute("class");
		var classes = classAttributeValue ? classAttributeValue.match(/\S+/g) : [];
		return {
			nodeName: nodeName,
			classes: classes,
			id: node.getAttribute("id")
		};
	}
	function prettifyCssText(cssText){
		var match = cssText.match(/^([^{]*)\{(.*?)\}$/);
		if(!match){
			return "";
		}
		var result = `${match[1]}{\r\n`;
		var partMatch, regex = /([^\s:]+)\s*:\s*(\S[^;]*);/g;
		while((partMatch = regex.exec(match[2])) != null){
			result += `    ${partMatch[1]}: ${partMatch[2]};\r\n`
		}
		return result + "}";
	}
	function serializeMatch(match){
		return {
			cssText: match.cssText,
			nodes: Array.prototype.map.apply(match.nodes, [(n) => summarizeNode(n)])
		};
	}
	function findSelectors(req){
		var query = new SelectorQuery(req.properties);
		console.log(`finding selectors for for which ${query.toString()}`);
		var matches = [];
		for(var match of findMatches(query)){
			console.log(`found css rule: ${match.cssText}. The following nodes match:`);
			for(var node of match.nodes){
				console.log(node)
			}
			matches.push(serializeMatch(match));
		}
		return matches;
	}
	var contentScriptId = +new Date() - Math.floor(Math.random() * 1000);
	console.log(`hello from content script ${contentScriptId}`)
	chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
		if(msg.contentScriptId !== contentScriptId){
			return;
		}
		if(msg.stopContentScript){
			console.log(`bye from content script ${contentScriptId}`)
		}else if(msg.findSelectors){
			var result = findSelectors(msg.req);
			sendResponse(result)
		}
	});
	chrome.runtime.sendMessage(undefined, {contentScriptLoaded: true, contentScriptId: contentScriptId});
})();
