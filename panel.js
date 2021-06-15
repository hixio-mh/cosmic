const { Atk, Clutter, Gio, GLib, GObject, Meta, Shell, St } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const extension = ExtensionUtils.getCurrentExtension();
const Main = imports.ui.main;
const Panel = imports.ui.panel;
const LayoutManager = imports.ui.layout;

var { CosmicTopBarButton } = extension.imports.top_bar_button;
var { OVERVIEW_WORKSPACES, OVERVIEW_APPLICATIONS, OVERVIEW_LAUNCHER, overview_visible, overview_show, overview_hide, overview_toggle } = extension.imports.overview;

// XXX duplicated
function settings_new_schema(schema) {
    const GioSSS = Gio.SettingsSchemaSource;
    const schemaDir = extension.dir.get_child("schemas");

    let schemaSource = schemaDir.query_exists(null) ?
        GioSSS.new_from_directory(schemaDir.get_path(), GioSSS.get_default(), false) :
        GioSSS.get_default();

    const schemaObj = schemaSource.lookup(schema, true);

    if (!schemaObj) {
        throw new Error("Schema " + schema + " could not be found for extension "
            + extension.metadata.uuid + ". Please check your installation.")
    }

    return new Gio.Settings({ settings_schema: schemaObj });
}


// could inject modification
const PANEL_ITEM_IMPLEMENTATIONS = { ...Panel.PANEL_ITEM_IMPLEMENTATIONS, activities: undefined, appMenu: undefined, aggregateMenu: undefined };

var PanelMonitor = GObject.registerClass({
}, class PanelMonitor extends Panel.Panel {
    _init(monitorIndex) {
        super._init();

        this.y_align = Clutter.ActorAlign.START;
        this.add_constraint(new LayoutManager.MonitorConstraint({ index: monitorIndex }));
        this.get_parent().remove_child(this);
        Main.layoutManager.addChrome(this, { affectsStruts: true, trackFullscreen: true });

        const settings = settings_new_schema(extension.metadata["settings-schema"]);

        const workspaces_button = new CosmicTopBarButton(settings, OVERVIEW_WORKSPACES);
        this.addToStatusArea("cosmic_workspaces", workspaces_button, 0, "left");

        // Add applications button
        const applications_button = new CosmicTopBarButton(settings, OVERVIEW_APPLICATIONS);
        this.addToStatusArea("cosmic_applications", applications_button, 1, "left");
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

