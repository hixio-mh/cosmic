const Panel = imports.ui.panel;

// could inject modification
const PANEL_ITEM_IMPLEMENTATIONS = { ...Panel.PANEL_ITEM_IMPLEMENTATIONS, aggregateMenu: undefined };

var PanelMonitor = GObject.registerClass({
}, class PanelMonitor extends Panel.Panel {
    _ensureIndicator(role) {
        let indicator = this.statusArea[role];  
        if (!indicator) {
            let constructor = PANEL_ITEM_IMPLEMENTATIONS[role];
            if (!constructor) {
                return null;
            }
            indicator = new constructor(this);
            this.statusArea[role] = indicator;
        }
        return indicator;
    }
});

