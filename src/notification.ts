import { MessageBus, Variant, sessionBus } from 'dbus-next';
import { KDEDevice } from './device';
import { checkSetup } from './errorTypes';
/*
interface eKDENotification{

}
*/
export class KDENotification {
	//events = new EventEmitter<eKDENotification>()
    
	device: KDEDevice
	private _notID: number
	private _bus: MessageBus

	notificationDataLoaded: Promise<void>

	private _appName!: string
	private _dismissable!: boolean
	private _silent!: boolean
	private _text!: string
	private _ticker!: string
	private _title!: string

	get appName() { return this._appName }
	get dismissable() { return this._dismissable }
	get silent() { return this._silent }
	get text() { return this._text }
	get ticker() { return this._ticker }
	get title() { return this._title }

	private async getInterface(name: string) {
		return (await this.getProxyObject()).getInterface(name)
	}

	private async getPropertiesOfInterface(interfaceName: string) {
		const obj = await this.getProxyObject()

		const entries = await obj.getInterface('org.freedesktop.DBus.Properties').GetAll(interfaceName) as { [key: string]: Variant }
		for (const i in entries) {
			entries[i] = entries[i].value
		}

		return entries as { [key: string]: any }
	}


	private async getProxyObject() {
		return await this._bus.getProxyObject('org.kde.kdeconnect.daemon', `/modules/kdeconnect/devices/${this.device.id}/notifications/${this._notID}`)
	}

	constructor(base: KDEDevice, notID: number, bus = sessionBus()) {
		this.device = base
		this._bus = bus
		this._notID = notID
		this.notificationDataLoaded = this.retrieveData()
	}

	private async retrieveData() {
		const {
			appName,
			dismissable,
			silent,
			text,
			ticker,
			title,
		} = await this.getPropertiesOfInterface('org.kde.kdeconnect.device.notifications.notification')
		this._appName = appName
		this._dismissable = dismissable
		this._silent = silent
		this._text = text
		this._ticker = ticker
		this._title = title

		Object.freeze(this)
	}

	async dismiss() {
		if (!this.dismissable) {
			return false
		}

		await checkSetup(this.device)

		const i = await this.getInterface('org.kde.kdeconnect.device.notifications.notification')
		i.dismiss()

		return true
	}
}
