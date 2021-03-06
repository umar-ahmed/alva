import * as Electron from 'electron';
import * as M from '../../message';
import * as Mobx from 'mobx';
import * as Model from '../../model';
import * as Menu from '../../menu';
import * as Types from '../../types';
import { ElectronHost } from '../../hosts/electron-host';

export class ElectronMainMenu {
	private server: Types.AlvaServer;

	@Mobx.observable private apps: Map<string, Model.AlvaApp> = new Map();
	@Mobx.observable private focusedAppId: string | undefined;
	@Mobx.observable private focusedProject: Model.Project | undefined;

	public constructor(init: { server: Types.AlvaServer }) {
		this.server = init.server;
	}

	@Mobx.computed
	public get focusedApp(): Model.AlvaApp | undefined {
		return this.focusedAppId ? this.apps.get(this.focusedAppId) : undefined;
	}

	public start(): void {
		this.server.sender.match<M.WindowFocused>(M.MessageType.WindowFocused, m => {
			const app = Model.AlvaApp.from(m.payload.app, { sender: this.server.sender });
			this.apps.set(app.getId(), app);
			this.focusedAppId = app.getId();
			app.setSender(this.server.sender);

			if (m.payload.projectId) {
				this.server.dataHost.getProject(m.payload.projectId).then(project => {
					this.focusedProject = project;
				});
			}
		});

		this.server.sender.match<M.WindowBlured>(M.MessageType.WindowBlured, m => {
			if (this.focusedAppId === m.appId) {
				this.focusedAppId = undefined;
			}

			if (this.focusedProject && this.focusedProject.getId() === m.payload.projectId) {
				this.focusedProject = undefined;
			}
		});

		this.server.sender.match<M.ChangeApp>(M.MessageType.ChangeApp, m => {
			const app = Model.AlvaApp.from(m.payload.app, { sender: this.server.sender });
			this.apps.set(app.getId(), app);
			app.setSender(this.server.sender);
		});

		Mobx.autorun(async () => {
			const ctx = {
				app: this.focusedApp,
				project: this.focusedProject
			};

			if (this.focusedApp) {
				((this.server.host as any) as ElectronHost).addApp(this.focusedApp);
			}

			const toElectronAction = (item: Types.MenuItem): Electron.MenuItemConstructorOptions[] => {
				if (typeof (item as any).click === 'function') {
					const actionable = item as Types.ActionableMenuItem;
					const onClick = actionable.click!;
					actionable.click = () => {
						if (!this.focusedApp) {
							return;
						}
						onClick(this.focusedApp);
					};
				}

				if (Array.isArray((item as any).submenu)) {
					const nested = item as Types.NestedMenuItem;
					(nested as any).submenu = nested.submenu.map(m => toElectronAction(m));
				}

				return item as any;
			};

			const template = [
				Menu.appMenu(ctx),
				Menu.fileMenu(ctx),
				Menu.editMenu(ctx),
				Menu.libraryMenu(ctx),
				Menu.viewMenu(ctx),
				Menu.windowMenu(ctx),
				Menu.helpMenu(ctx)
			].map(toElectronAction);

			const menu = Electron.Menu.buildFromTemplate(template as any);
			Electron.Menu.setApplicationMenu(menu);
		});
	}

	public getApp(id: string): Model.AlvaApp | undefined {
		return this.apps.get(id);
	}
}
