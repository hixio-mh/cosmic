const { Atk, Clutter, Gio, GLib, GObject, Meta, Shell, St } = imports.gi;

const Main = imports.ui.main;
const Panel = imports.ui.panel;
const LayoutManager = imports.ui.layout;

// could inject modification
const PANEL_ITEM_IMPLEMENTATIONS = { ...Panel.PANEL_ITEM_IMPLEMENTATIONS, aggregateMenu: undefined };

var PanelMonitor = GObject.registerClass({
}, class PanelMonitor extends Panel.Panel {
    _init(monitorIndex) {
        super._init();

        this.y_align = Clutter.ActorAlign.START;
	this.add_constraint(new LayoutManager.MonitorConstraint({ index: monitorIndex }));
	this.get_parent().remove_child(this);
	Main.layoutManager.addChrome(this, { affectsStruts: true, trackFullscreen: true });
    }

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

