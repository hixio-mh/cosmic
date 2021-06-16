const { Clutter, GLib, GObject, Meta, Shell, St } = imports.gi;
const Background = imports.ui.background;
const Main = imports.ui.main;
const LayoutManager = imports.ui.layout;
const ViewSelector = imports.ui.viewSelector;
const WorkspaceThumbnail = imports.ui.workspaceThumbnail;
const OverviewControls = imports.ui.overviewControls;
const Overview = imports.ui.overview;
const Dash = imports.ui.dash;
var { ControlsLayout, DashSlider, DashSpacer, ThumbnailsSlider } = imports.ui.overviewControls;
var { ThumbnailState } = imports.ui.workspaceThumbnail;
var { ShellInfo } = imports.ui.overview;

class OverviewMonitor extends Overview.Overview {
    constructor(monitorIndex) {
        super();
        this._monitorIndex = monitorIndex;
        this.init();
    }

    init() {
        this._initCalled = true;

        if (this.isDummy)
            return;

        //this._overview = new OverviewActor();
        this._overview = new OverviewActorMonitor(this._monitorIndex);
        this._overview._delegate = this;
        Main.layoutManager.overviewGroup.add_child(this._overview);
        this._overview.connect('notify::allocation', () => this.emit('relayout'));

        this._shellInfo = new ShellInfo();

        Main.layoutManager.connect('monitors-changed', this._relayout.bind(this));
        this._relayout();

        //this._showingId = Main.overview.connect('showing', () => this.show());
        //this._hidingId = Main.overview.connect('hiding', () => this.hide());
    }

    _updateBackgrounds() {
    }

    /*
    _relayout() {
        // To avoid updating the position and size of the workspaces
        // we just hide the overview. The positions will be updated
        // when it is next shown.
        this.hide();

        this._coverPane.set_position(0, 0);
        this._coverPane.set_size(global.screen_width, global.screen_height);
        
        //this._updateBackgrounds();
    }

    _createOverview() {
        super._createOverview();
        Main.layoutManager.overviewGroup.remove_child(this._coverPane);
    }
    */
}

var OverviewActorMonitor = GObject.registerClass(
class OverviewActorMonitor extends St.BoxLayout {
    _init(monitorIndex) {
        super._init({
            vertical: true,
        });

        this.add_constraint(new LayoutManager.MonitorConstraint({ index: monitorIndex }));

        this._spacer = new St.Widget();
        this.add_actor(this._spacer);

        const searchEntry = new St.Entry({}); // placeholder
        //this._controls = new ControlsManagerMonitor(searchEntry, monitorIndex);
        this._controls = new MultiMonitorsControlsManager(monitorIndex);
        this.add_child(this._controls);

        /*
        this._showingId = Main.overview.connect('showing', () => this._controls.show());
        this._hidingId = Main.overview.connect('hiding', () => this._controls.hide());
        this.connect('destroy', () => {
            Main.overview.disconnect(this._showingId);
            Main.overview.disconnect(this._hidingId);
        });
        */
    }
});

var MultiMonitorsControlsManager = GObject.registerClass(
class MultiMonitorsControlsManager extends St.Widget {
    _init(index) {
        this._monitorIndex = index;
        this._workspacesViews = null;
        this._spacer_height = 0;
        this._visible = false;
        
        let layout = new OverviewControls.ControlsLayout();
        super._init({
            layout_manager: layout,
            x_expand: true,
            y_expand: true,
            clip_to_allocation: true,
        });

        this._workspaceAdjustment = Main.overview._overview._controls._workspaceAdjustment;

        //this._thumbnailsBox =
        //    new MultiMonitorsThumbnailsBox(this._workspaceAdjustment, this._monitorIndex);
        this._thumbnailsBox = new ThumbnailsBoxMonitor(this._workspaceAdjustment, this._monitorIndex);
        this._thumbnailsSlider = new OverviewControls.ThumbnailsSlider(this._thumbnailsBox); // Changed

        this._viewSelector = new St.Widget({ visible: false, x_expand: true, y_expand: true, clip_to_allocation: true });
        this._pageChangedId = Main.overview.viewSelector.connect('page-changed', this._setVisibility.bind(this));
        this._pageEmptyId = Main.overview.viewSelector.connect('page-empty', this._onPageEmpty.bind(this));

        this._group = new St.BoxLayout({ name: 'mm-overview-group-'+index,
                                         x_expand: true, y_expand: true });
        this.add_actor(this._group);

        this._group.add_child(this._viewSelector);
        this._group.add_actor(this._thumbnailsSlider);

        //this._settings = Convenience.getSettings();
        //this._thumbnailsOnLeftSideId = this._settings.connect('changed::'+THUMBNAILS_ON_LEFT_SIDE_ID,
        //                                                        this._thumbnailsOnLeftSide.bind(this));
        this._thumbnailsOnLeftSide();
        this._thumbnailsSlider.slideOut();
        this._thumbnailsBox._updatePorthole();

        this.connect('notify::allocation', this._updateSpacerVisibility.bind(this));
        this.connect('destroy', this._onDestroy.bind(this));

        // Added
        this._thumbnailsSlider.layout.slideDirection = OverviewControls.SlideDirection.LEFT;
    }

    _onDestroy() {
        Main.overview.viewSelector.disconnect(this._pageChangedId);
        Main.overview.viewSelector.disconnect(this._pageEmptyId);
        //this._settings.disconnect(this._thumbnailsOnLeftSideId);
    }

    _thumbnailsOnLeftSide() {
        let thumbnailsSlider;
        thumbnailsSlider = this._thumbnailsSlider;

        //if (this._settings.get_boolean(THUMBNAILS_ON_LEFT_SIDE_ID)) {
        if (true) {
            let first = this._group.get_first_child();
            if (first != thumbnailsSlider) {
                this._thumbnailsSlider.layout.slideDirection = OverviewControls.SlideDirection.LEFT;
                this._thumbnailsBox.remove_style_class_name('workspace-thumbnails');
                this._thumbnailsBox.set_style_class_name('workspace-thumbnails workspace-thumbnails-left');
                this._group.set_child_below_sibling(thumbnailsSlider, first)
            }
        }
        else {
            let last = this._group.get_last_child();
            if (last != thumbnailsSlider) {
                this._thumbnailsSlider.layout.slideDirection = OverviewControls.SlideDirection.RIGHT;
                this._thumbnailsBox.remove_style_class_name('workspace-thumbnails workspace-thumbnails-left');
                this._thumbnailsBox.set_style_class_name('workspace-thumbnails');
                this._group.set_child_above_sibling(thumbnailsSlider, last);
            }
        }
    }

    _updateSpacerVisibility() {
        if (Main.layoutManager.monitors.length<this._monitorIndex)
            return;

        let top_spacer_height = Main.layoutManager.primaryMonitor.height;

        let panelGhost_height = 0;
        //if (Main.mmOverview[this._monitorIndex]._overview._panelGhost)
        //if (global.foobar._panelGhost)
            //panelGhost_height = Main.mmOverview[this._monitorIndex]._overview._panelGhost.get_height();
        //    panelGhost_height = global.foobar._panelGhost.get_height();

        let allocation = Main.overview._overview._controls.allocation;
        let primaryControl_height = allocation.get_height();
        let bottom_spacer_height = Main.layoutManager.primaryMonitor.height - allocation.y2;

        top_spacer_height -= primaryControl_height + panelGhost_height + bottom_spacer_height;
        top_spacer_height = Math.round(top_spacer_height);

        //let spacer = Main.mmOverview[this._monitorIndex]._overview._spacer;
        let spacer = global.foobar._spacer;
        if (spacer.get_height()!=top_spacer_height) {
            this._spacer_height = top_spacer_height;
            spacer.set_height(top_spacer_height);
        }
    }

    getWorkspacesActualGeometry() {
        let geometry;
        if (this._visible) {
            const [x, y] = this._viewSelector.get_transformed_position();
            const width = this._viewSelector.allocation.get_width();
            const height = this._viewSelector.allocation.get_height();
            geometry = { x, y, width, height };
        }
        else {
            let [x, y] = this.get_transformed_position();
            const width = this.allocation.get_width();
            let height = this.allocation.get_height();
            y -= this._spacer_height;
            height += this._spacer_height;
            geometry = { x, y, width, height };
        }
        if (isNaN(geometry.x))
            return null;
        //global.log("actualG+ i: "+this._monitorIndex+" x: "+geometry.x+" y: "+geometry.y+" width: "+geometry.width+" height: "+geometry.height);
        return geometry;
    }

    _setVisibility() {
        // Ignore the case when we're leaving the overview, since
        // actors will be made visible again when entering the overview
        // next time, and animating them while doing so is just
        // unnecessary noise
        if (!Main.overview.visible ||
            (Main.overview.animationInProgress && !Main.overview.visibleTarget))
            return;

        let activePage = Main.overview.viewSelector.getActivePage();
        let thumbnailsVisible = activePage == ViewSelector.ViewPage.WINDOWS;

        let opacity = null;
        if (thumbnailsVisible) {
            opacity = 255;
            this._thumbnailsSlider.slideIn();
        }
        else {
            opacity = 0;
            this._thumbnailsSlider.slideOut();
        }

        if (!this._workspacesViews)
            return;

        this._workspacesViews.ease({
            opacity: opacity,
            duration: OverviewControls.SIDE_CONTROLS_ANIMATION_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
    }

    _onPageEmpty() {
        this._thumbnailsSlider.pageEmpty();
    }
    
    /*
    show() {
        this._viewSelector.visible = true;
        this._workspacesViews = Main.overview.viewSelector._workspacesDisplay._workspacesViews[this._monitorIndex];
        this._visible = true;
        const geometry = this.getWorkspacesActualGeometry();

        if (!geometry) {
            return;
        }

        this._workspacesViews.ease({
            ...geometry,
            duration: Main.overview.animationInProgress ? Overview.ANIMATION_TIME : 0,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
    }

    hide() {
        this._visible = false;
        this._workspacesViews.opacity = 255;
        const geometry = this.getWorkspacesActualGeometry();
        this._workspacesViews.ease({
            ...geometry,
            duration: Main.overview.animationInProgress ? Overview.ANIMATION_TIME : 0,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                this._viewSelector.visible = false;
            },
        });
        this._workspacesViews = null;
    }
    */
});


var ControlsManagerMonitor = GObject.registerClass(
class ControlsManagerMonitor extends OverviewControls.ControlsManager {
    _init(searchEntry, monitorIndex) {
        let layout = new ControlsLayout();
        St.Widget.prototype._init.call(this, {
            layout_manager: layout,
            x_expand: true,
            y_expand: true,
            clip_to_allocation: true,
        });

        this.dash = new Dash.Dash();
        this._dashSlider = new DashSlider(this.dash);
        this._dashSpacer = new DashSpacer();
        this._dashSpacer.setDashActor(this._dashSlider);
        
        let workspaceManager = global.workspace_manager;
        let activeWorkspaceIndex = workspaceManager.get_active_workspace_index();
                     
        this._workspaceAdjustment = new St.Adjustment({
            actor: this,
            value: activeWorkspaceIndex,
            lower: 0,
            page_increment: 1,
            page_size: 1,
            step_increment: 0,
            upper: workspaceManager.n_workspaces,
        });
        
        this._nWorkspacesNotifyId =
            workspaceManager.connect('notify::n-workspaces',
                this._updateAdjustment.bind(this));
        
        //this._thumbnailsBox =
        //    new WorkspaceThumbnail.ThumbnailsBox(this._workspaceAdjustment);
        this._thumbnailsBox = new ThumbnailsBoxMonitor(this._workspaceAdjustment, monitorIndex);
        this._thumbnailsSlider = new ThumbnailsSlider(this._thumbnailsBox);

        //this.viewSelector = new St.Widget({ visible: false, x_expand: true, y_expand: true, clip_to_allocation: true });
        this.viewSelector = new ViewSelector.ViewSelector(searchEntry,
            this._workspaceAdjustment, this.dash.showAppsButton);
        //this.viewSelector.connect('page-changed', this._setVisibility.bind(this));
        //this.viewSelector.connect('page-empty', this._onPageEmpty.bind(this));

        this._group = new St.BoxLayout({ name: 'overview-group',
                                         x_expand: true, y_expand: true });
        this.add_actor(this._group);

        this.add_actor(this._dashSlider);

        this._group.add_actor(this._dashSpacer);
        this._group.add_child(this.viewSelector);
        this._group.add_actor(this._thumbnailsSlider);

        Main.overview.connect('showing', this._updateSpacerVisibility.bind(this));

        this.connect('destroy', this._onDestroy.bind(this));

        // Added
            this._thumbnailsSlider._getAlwaysZoomOut = () => true;
        this.dash.hide();
        this.viewSelector._onStageKeyPress = function(actor, event) {};
        //this.viewSelector.x_expand = true;
        //this.viewSelector.y_expand = true;
        // this._thumbnailsSlider.layout.slideDirection = OverviewControls.SlideDirection.LEFT;
        //this._pageChangedId = Main.overview.viewSelector.connect('page-changed', this._setVisibility.bind(this));
        //this._pageEmptyId = Main.overview.viewSelector.connect('page-empty', this._onPageEmpty.bind(this));
    }
});

var WorkspaceThumbnailMonitor = GObject.registerClass(
class WorkspaceThumbnailMonitor extends WorkspaceThumbnail.WorkspaceThumbnail {
    _init(metaWorkspace, monitorIndex) {
        St.Widget.prototype._init.call(this, {
            clip_to_allocation: true,
            style_class: 'workspace-thumbnail',
        });
        this._delegate = this;

        this.metaWorkspace = metaWorkspace;
        this.monitorIndex = monitorIndex; // Changed from `Main.layoutManager.primaryIndex`

        this._removed = false;

        this._contents = new Clutter.Actor();
        this.add_child(this._contents);

        this.connect('destroy', this._onDestroy.bind(this));

        this._createBackground();

        let workArea = Main.layoutManager.getWorkAreaForMonitor(this.monitorIndex);
        this.setPorthole(workArea.x, workArea.y, workArea.width, workArea.height);

        let windows = global.get_window_actors().filter(actor => {
            let win = actor.meta_window;
            return win.located_on_workspace(metaWorkspace);
        });

        // Create clones for windows that should be visible in the Overview
        this._windows = [];
        this._allWindows = [];
        this._minimizedChangedIds = [];
        for (let i = 0; i < windows.length; i++) {
            let minimizedChangedId =
                windows[i].meta_window.connect('notify::minimized',
                                               this._updateMinimized.bind(this));
            this._allWindows.push(windows[i].meta_window);
            this._minimizedChangedIds.push(minimizedChangedId);

            if (this._isMyWindow(windows[i]) && this._isOverviewWindow(windows[i]))
                this._addWindowClone(windows[i]);
        }

        // Track window changes
        this._windowAddedId = this.metaWorkspace.connect('window-added',
                                                         this._windowAdded.bind(this));
        this._windowRemovedId = this.metaWorkspace.connect('window-removed',
                                                           this._windowRemoved.bind(this));
        this._windowEnteredMonitorId = global.display.connect('window-entered-monitor',
                                                              this._windowEnteredMonitor.bind(this));
        this._windowLeftMonitorId = global.display.connect('window-left-monitor',
                                                           this._windowLeftMonitor.bind(this));

        this.state = ThumbnailState.NORMAL;
        this._slidePosition = 0; // Fully slid in
        this._collapseFraction = 0; // Not collapsed
    }

    _createBackground() {
        this._bgManager = new Background.BackgroundManager({ monitorIndex: this.monitorIndex, // Changed from `Main.layoutManager.primaryIndex`
                                                             container: this._contents,
                                                             vignette: false });
    }
});

var ThumbnailsBoxMonitor = GObject.registerClass(
class ThumbnailsBoxMonitor extends WorkspaceThumbnail.ThumbnailsBox {
    _init(scrollAdjustment, monitorIndex) {
        this.monitorIndex = monitorIndex;

        super._init(scrollAdjustment);

        // XXX
        //controls._thumbnailsBox.set_style_class_name('workspace-thumbnails workspace-thumbnails-left'); // XXX
        //this._updatePorthole();
    }

    addThumbnails(start, count) {
        let workspaceManager = global.workspace_manager;

        for (let k = start; k < start + count; k++) {
            let metaWorkspace = workspaceManager.get_workspace_by_index(k);
            let thumbnail = new WorkspaceThumbnailMonitor(metaWorkspace, this.monitorIndex); // Changed from `new WorkspaceThumbnail(metaWorkspace)`
            //let thumbnail = new WorkspaceThumbnail.WorkspaceThumbnail(metaWorkspace);
            thumbnail.setPorthole(this._porthole.x, this._porthole.y,
                                  this._porthole.width, this._porthole.height);
            this._thumbnails.push(thumbnail);
            this.add_actor(thumbnail);

            if (start > 0 && this._spliceIndex == -1) {
                // not the initial fill, and not splicing via DND
                thumbnail.state = ThumbnailState.NEW; 
                thumbnail.slide_position = 1; // start slid out
                this._haveNewThumbnails = true;
            } else {
                thumbnail.state = ThumbnailState.NORMAL;
            }

            this._stateCounts[thumbnail.state]++;
        }

        this._queueUpdateStates();

        // The thumbnails indicator actually needs to be on top of the thumbnails
        this.set_child_above_sibling(this._indicator, null);

        // Clear the splice index, we got the message
        this._spliceIndex = -1;
    }

    _updatePorthole() {
        this._porthole = Main.layoutManager.getWorkAreaForMonitor(this.monitorIndex);
        
        this.queue_relayout();
    }
});
