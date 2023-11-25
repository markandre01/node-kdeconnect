import { MessageBus, Variant, sessionBus } from 'dbus-next';
import EventEmitter from 'eventemitter3';
import path from 'path';
import { basicCheckSetup, basicWrapCheckDeorator, checkSetup, wrapCheckDeorator } from './errorTypes';
import { KDEMediaHandler } from './media';
import { KDENotification } from './notification';
import { KDEPairingRequest } from './pairingRequest';

interface eKDEDevice {
    'onTrustedChanged': (v: boolean) => void
    'onNameChanged': (v: string) => void
    'onTypeChanged': (v: string) => void
    'onReachableChanged': (v: boolean) => void
    'onBatteryChanged': (v: iKDEDeviceBattery) => void
    'onConnectivityChanged': (v: iKDEDeviceConnectivity) => void
    'onPairingRequest': (request: KDEPairingRequest) => void
}

interface iKDEDeviceBattery {
    charge: number,
    charging: boolean
}

interface iKDEDeviceConnectivity {
    type: string,
    strength: number
}

export class KDEDevice {
	events = new EventEmitter<eKDEDevice>()

	private _id: string
	private _bus: MessageBus

	private _setupDone = false
	private _name = ''
	private _isReachable = false
	private _isTrusted = false
	private _type = ''

	private _battery?: iKDEDeviceBattery
	private _connectivity?: iKDEDeviceConnectivity

	get id() { return this._id }
	get name() { return this._name }
	get type() { return this._type }
	get isReachable() { return this._isReachable }
	get isTrusted() { return this._isTrusted }
	get connectivity() { return this._connectivity }
	get battery() { return this._battery }
	get setupDone() { return this._setupDone }

	media!: KDEMediaHandler

	private async getProxyObject(path: string) {
		if (path.length) {
			path = `/${path}`
		}

		return await this._bus.getProxyObject('org.kde.kdeconnect.daemon', `/modules/kdeconnect/devices/${this._id}${path}`)
	}

	private async getInterface(path: string, name: string) {
		return (await this.getProxyObject(path)).getInterface(name)
	}

	private async getPropertiesOfInterface(path: string, interfaceName: string) {
		const obj = await this.getProxyObject(path)

		const entries = await obj.getInterface('org.freedesktop.DBus.Properties').GetAll(interfaceName) as { [key: string]: Variant }
		for (const i in entries) {
			entries[i] = entries[i].value
		}

		return entries as { [key: string]: any }
	}

	private basicWrapCheckDeorator = basicWrapCheckDeorator.bind(undefined, this)
	private wrapCheckDeorator = wrapCheckDeorator.bind(undefined, this)
	private basicCheckSetup = basicCheckSetup.bind(undefined, this)
	private checkSetup = checkSetup.bind(undefined, this)

	constructor(id: string, bus = sessionBus()) {
		this._id = id
		this._bus = bus
	}

	private async iSetup() {
		{
			const {
				charge,
				isCharging
			} = await this.getPropertiesOfInterface('battery', 'org.kde.kdeconnect.device.battery')
			this._battery = {
				charge,
				charging: isCharging
			}

			const interf = await this.getInterface('battery', 'org.kde.kdeconnect.device.battery')
			interf.on('refreshed', (charging: boolean, charge: number) => {
				this._battery = {
					charge,
					charging
				}
				this.events.emit('onBatteryChanged', this._battery)
			})
		}

		{
			const {
				cellularNetworkType: type,
				cellularNetworkStrength: strength
			} = await this.getPropertiesOfInterface('connectivity_report', 'org.kde.kdeconnect.device.connectivity_report')
			this._connectivity = {
				type,
				strength
			}

			const interf = await this.getInterface('connectivity_report', 'org.kde.kdeconnect.device.connectivity_report')
			interf.on('refreshed', (type: string, strength: number) => {
				this._connectivity = {
					type,
					strength
				}
				this.events.emit('onConnectivityChanged', this._connectivity)
			})

		}
		{
			const interf = await this.getInterface('findmyphone', 'org.kde.kdeconnect.device.findmyphone')
			this.ring = this.wrapCheckDeorator(interf.ring as any)
		}

		{
			const interf = await this.getInterface('ping', 'org.kde.kdeconnect.device.ping')
			this.ping = this.wrapCheckDeorator(async msg => await interf.sendPing(msg ?? ''))
		}

		{
			const interf = await this.getInterface('share', 'org.kde.kdeconnect.device.share')
			this.shareURL = this.wrapCheckDeorator(interf.shareUrl as any)
			this.shareText = this.wrapCheckDeorator(interf.shareText as any)
		}
	}

	async setup() {
		if (this._setupDone) {
			return
		}

		const {
			isReachable,
			isTrusted,
			name,
			isPaired,
			type
		} = await this.getPropertiesOfInterface('', 'org.kde.kdeconnect.device')
		this._isReachable = isReachable
		this._isTrusted = isTrusted || isPaired
		this._name = name
		this._type = type

		const interf = await this.getInterface('', 'org.kde.kdeconnect.device')
		interf.on('reachableChanged', i => {
			this._isReachable = i
			if (i) {
				this.iSetup()
			} else {
				this._battery = undefined
				this._connectivity = undefined
				this.media.clear()
			}
			this.events.emit('onReachableChanged', i)
		})
		interf.on('trustedChanged', i => {
			this._isTrusted = i
			if (i) {
				this.iSetup()
			} else {
				this._battery = undefined
				this._connectivity = undefined
				this.media.clear()
			}
			this.events.emit('onTrustedChanged', i)
		})
		interf.on('hasPairingRequestsChanged', async i => {
			if (!i) {
				return
			}

			const out = new KDEPairingRequest(this, this._bus)
			await out.pairingRequestDetupDone
			this.events.emit('onPairingRequest', out)
		})
		interf.on('nameChanged', i => {
			this._name = i
			this.events.emit('onNameChanged', i)
		})
		interf.on('typeChanged', i => {
			this._type = i
			this.events.emit('onTypeChanged', i)
		})

		if (this.isReachable) {
			this.requestPair = this.basicWrapCheckDeorator(interf.requestPair as any)
		}

		if (this.isReachable && this.isTrusted) {
			this.unpair = this.wrapCheckDeorator(interf.unpair as any)

			await this.iSetup()
		}

		this._setupDone = true
		this.media = new KDEMediaHandler(this, this._bus)
	}

	async getNotifications() {
		this.checkSetup()
		const interf = await this.getInterface('notifications', 'org.kde.kdeconnect.device.notifications')
		const av = await interf.activeNotifications() as number[]

		const r = av.map(i => new KDENotification(this, i, this._bus))

		await Promise.all(r.map(i => i.notificationDataLoaded))

		return r
	}

	async shareFile(pathToFile: string) {
		this.checkSetup()
		this.shareURL(`file://${path.resolve(pathToFile)}`)
	}

	ring: () => Promise<void> = this.checkSetup
	ping: (msg?: string) => Promise<void> = this.checkSetup
	shareURL: (url: string) => Promise<void> = this.checkSetup
	shareText: (text: string) => Promise<void> = this.checkSetup // to clipboard
	requestPair: () => Promise<void> = this.basicCheckSetup
	unpair: () => Promise<void> = this.checkSetup
}
