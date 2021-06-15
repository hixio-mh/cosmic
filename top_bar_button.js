const { Atk, Clutter, Gio, GLib, GObject, Meta, Shell, St } = imports.gi;
const Main = imports.ui.main;
const OverviewControls = imports.ui.overviewControls;
const PanelMenu = imports.ui.panelMenu;


var OVERVIEW_WORKSPACES = 0;
var OVERVIEW_APPLICATIONS = 1;
var OVERVIEW_LAUNCHER = 2;


var CosmicTopBarButton = GObject.registerClass(
class CosmicTopBarButton extends PanelMenu.Button {
    _init(settings, kind = null) {
        super._init(0.0, null, true);
        this.accessible_role = Atk.Role.TOGGLE_BUTTON;

        /* Translators: If there is no suitable word for "Activities"
           in your language, you can use the word for "Overview". */
        let name = "Activities";
        if (kind === OVERVIEW_APPLICATIONS) {
            name = "Applications";
            settings.bind("show-applications-button", this, "visible", Gio.SettingsBindFlags.DEFAULT);
        } else if (kind == OVERVIEW_WORKSPACES) {
            name = "Workspaces";
            settings.bind("show-workspaces-button", this, "visible", Gio.SettingsBindFlags.DEFAULT);
        }
        this.name = 'panel' + name;
        this.kind = kind;

        this._label = new St.Label({ text: _(name),
                                     y_align: Clutter.ActorAlign.CENTER });
        this.add_actor(this._label);

        this.label_actor = this._label;

        const perform_update = () => this.update();

        const signals = [
            Main.overview.connect('shown', perform_update),
            Main.overview.connect('hidden', perform_update),
        ];

		// This signal cannot be connected until Main.overview is initialized
		GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            if (Main.overview._initCalled) {
    			Main.overview.viewSelector.connect('page-changed', () => {
    				this.update();
    			});
    			return GLib.SOURCE_REMOVE;
            } else {
                return GLib.SOURCE_CONTINUE;
            }
		});

        this._xdndTimeOut = null;

        this.connect('destroy', () => {
            for (const signal of signals) GLib.source_remove(signal);

            if (this._xdndTimeOut !== null) GLib.source_remove(this._xdndTimeOut);

            Gio.Settings.unbind(this, "visible");
        });
    }

    toggle() {
        overview_toggle(this.kind);
    }

    update() {
        if (overview_visible(this.kind)) {
            this.add_style_pseudo_class('overview');
            this.add_accessible_state(Atk.StateType.CHECKED);
        } else {
            this.remove_style_pseudo_class('overview');
            this.remove_accessible_state(Atk.StateType.CHECKED);
        }
    }

    handleDragOver(source, _actor, _x, _y, _time) {
        if (source != Main.xdndHandler)
            return DND.DragMotionResult.CONTINUE;

        if (this._xdndTimeOut !== null)
            GLib.source_remove(this._xdndTimeOut);
        this._xdndTimeOut = GLib.timeout_add(GLib.PRIORITY_DEFAULT, BUTTON_DND_ACTIVATION_TIMEOUT, () => {
            this._xdndToggleOverview();
        });
        GLib.Source.set_name_by_id(this._xdndTimeOut, '[gnome-shell] this._xdndToggleOverview');

        return DND.DragMotionResult.CONTINUE;
    }

    vfunc_captured_event(event) {
        if (event.type() == Clutter.EventType.BUTTON_PRESS ||
            event.type() == Clutter.EventType.TOUCH_BEGIN) {
            if (!Main.overview.shouldToggleByCornerOrButton())
                return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    vfunc_event(event) {
        if (event.type() == Clutter.EventType.TOUCH_END ||
            event.type() == Clutter.EventType.BUTTON_RELEASE) {
            if (Main.overview.shouldToggleByCornerOrButton())
                this.toggle();
        }

        return Clutter.EVENT_PROPAGATE;
    }

    vfunc_key_release_event(keyEvent) {
        let symbol = keyEvent.keyval;
        if (symbol == Clutter.KEY_Return || symbol == Clutter.KEY_space) {
            if (Main.overview.shouldToggleByCornerOrButton()) {
                this.toggle();
                return Clutter.EVENT_STOP;
            }
        }

        return Clutter.EVENT_PROPAGATE;
    }

    _xdndToggleOverview() {
        let [x, y] = global.get_pointer();
        let pickedActor = global.stage.get_actor_at_pos(Clutter.PickMode.REACTIVE, x, y);

        if (pickedActor == this && Main.overview.shouldToggleByCornerOrButton())
            this.toggle();

        if (this._xdndTimeOut !== null) GLib.source_remove(this._xdndTimeOut);
        this._xdndTimeOut = null;

        return GLib.SOURCE_REMOVE;
    }
});
