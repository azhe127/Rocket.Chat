export class RocketletsRestApi {
	constructor(manager) {
		this._manager = manager;
		this.api = new RocketChat.API.ApiClass({
			version: 'rocketlets',
			useDefaultAuth: true,
			prettyJson: true,
			enableCors: false,
			auth: RocketChat.API.getUserAuth()
		});

		this.addManagementRoutes();
	}

	_handleFile(request, fileField) {
		const Busboy = Npm.require('busboy');
		const busboy = new Busboy({ headers: request.headers });

		return Meteor.wrapAsync((callback) => {
			busboy.on('file', Meteor.bindEnvironment((fieldname, file) => {
				if (fieldname !== fileField) {
					return callback(new Meteor.Error('invalid-field', `Expected the field "${ fileField }" but got "${ fieldname }" instead.`));
				}

				const fileData = [];
				file.on('data', Meteor.bindEnvironment((data) => {
					fileData.push(data);
				}));

				file.on('end', Meteor.bindEnvironment(() => callback(undefined, Buffer.concat(fileData))));
			}));

			request.pipe(busboy);
		})();
	}

	addManagementRoutes() {
		const manager = this._manager;
		const fileHandler = this._handleFile;

		this.api.addRoute('', { authRequired: true }, {
			get() {
				const rocketlets = manager.get().map(prl => {
					if (this.queryParams.languagesOnly) {
						return {
							id: prl.getID(),
							languages: prl.getStorageItem().languageFiles
						};
					} else {
						const info = prl.getInfo();
						info.languages = prl.getStorageItem().languageFiles;

						return info;
					}
				});

				return { success: true, rocketlets };
			},
			post() {
				const buff = fileHandler(this.request, 'rocketlet');
				const item = Meteor.wrapAsync((callback) => {
					manager.add(buff.toString('base64')).then((rl) => callback(undefined, rl)).catch((e) => {
						console.warn('Error!', e);
						callback(e);
					});
				})();

				return { success: true, rocketlet: item.rocketlet.info };
			}
		});

		this.api.addRoute(':id', { authRequired: true }, {
			get() {
				console.log('Getting:', this.urlParams.id);
				const prl = manager.getOneById(this.urlParams.id);

				if (prl) {
					const info = prl.getInfo();
					info.languages = prl.getStorageItem().languageFiles;

					return { success: true, rocketlet: info };
				} else {
					return RocketChat.API.v1.notFound(`No Rocketlet found by the id of: ${ this.urlParams.id }`);
				}
			},
			post() {
				console.log('Updating:', this.urlParams.id);
				// TODO: Verify permissions

				const buff = fileHandler(this.request, 'rocketlet');
				const item = Meteor.wrapAsync((callback) => {
					manager.update(buff.toString('base64')).then((rl) => callback(rl)).catch((e) => callback(e));
				});

				return { success: false, item };
			}
		});
	}
}