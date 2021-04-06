import { FakeInspectedWindow } from './fake-inspected-window';
import { Event } from '../src/shared/events';
import { FakeNavigationInterface } from './fake-navigation-interface';
import { FakeCrossBoundaryEventFactory } from './fake-cross-boundary-event-factory';
import { devtoolsFunction } from '../src/devtools/devtools-function';
import { whenReturns } from './when-returns';

describe('given the dependencies', () => {
    let inspectedWindow;
    let createSidebarPaneInElements;
    let elementSelectionChanged;
    let navigationInterface;
    let crossBoundaryEventFactory;
    let tabId;

    beforeEach(() => {
        tabId = 1;
        inspectedWindow = new FakeInspectedWindow(tabId);
        createSidebarPaneInElements = jest.fn();
        elementSelectionChanged = new Event();
        navigationInterface = new FakeNavigationInterface();
        crossBoundaryEventFactory = new FakeCrossBoundaryEventFactory();
    });

    describe('and the devtools function is executed', () => {

        beforeEach(() => {
            devtoolsFunction(inspectedWindow, createSidebarPaneInElements, elementSelectionChanged, navigationInterface, crossBoundaryEventFactory);
        });

        it('should have created a sidebar pane in elements', () => {
            expect(createSidebarPaneInElements).toHaveBeenCalledWith('Macros', 'devtools_sidebar.html');
        });

        describe('and the element selection changes', () => {
            let notification;

            beforeEach(async () => {
                const notificationPromise = crossBoundaryEventFactory.events['elementSelectionChangedForTab'].source.nextMessage();
                elementSelectionChanged.dispatch();
                notification = await notificationPromise;
            });

            it('should emit that the element selection has changed for the tab', () => {
                expect(notification).toEqual(tabId);
            });

            describe('and then the notification arrives that the element selection has changed for a navigation', () => {
                let navigation;
                let evalInvocation;

                beforeEach(async () => {
                    navigation = {
                        id: 1,
                        frameId: 1,
                        url: 'http://a.b/c'
                    };
                    jest.spyOn(navigationInterface, 'getNavigation').mockImplementation(() => Promise.resolve(navigation));
                    const evalPromise = whenReturns(inspectedWindow, 'eval');
                    crossBoundaryEventFactory.events['elementSelectionChangedForNavigation'].target.sendMessage(navigation.id);
                    evalInvocation = await evalPromise;
                });

                it('should', () => {
                    expect(evalInvocation.args).toEqual([
                        'contentScript.elementSelectedInDevtools($0)',
                        {
                            useContentScriptContext: true,
                            frameURL: navigation.url
                        }
                    ]);
                });
            });
        });
    });
});