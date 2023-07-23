'use strict';

import { ClientInterface, MessageBus, Variant, sessionBus } from 'dbus-next';
import EventEmitter from 'eventemitter3';
import path from 'path';

class KDEBase {
	protected _id: string
	protected _bus: MessageBus

	protected async getProxyObject(path: string) {
		if (path.length) {
			path = `/${path}`
		}

		return await this._bus.getProxyObject('org.kde.kdeconnect.daemon', `/modules/kdeconnect/devices/${this._id}${path}`)
	}

	protected async getInterface(path: string, name: string) {
		return (await this.getProxyObject(path)).getInterface(name)
	}

	protected async getPropertiesOfInterface(path: string, interfaceName: string) {
		const obj = await this.getProxyObject(path)

		const entries = await obj.getInterface('org.freedesktop.DBus.Properties').GetAll(interfaceName) as { [key: string]: Variant }
		for (const i in entries) {
			entries[i] = entries[i].value
		}

		return entries as { [key: string]: any }
	}

	constructor(id: string, bus = sessionBus()) {
		this._id = id
		this._bus = bus
	}
}

class KDENotification extends KDEBase {
	private _notID: number
	notificationDataLoaded: Promise<void>

	appName!: string
	dismissable!: boolean
	hasIcon!: boolean
	silent!: boolean
	text!: string
	ticker!: string
	title!: string

	protected async getProxyObject() {
		return super.getProxyObject(`notifications/${this._notID}`)
	}

	constructor(id: string, notID: number, bus = sessionBus()) {
		super(id, bus)
		this._notID = notID
		this.notificationDataLoaded = this.retrieveData()
	}

	private async retrieveData() {
		const {
			appName,
			dismissable,
			hasIcon,
			silent,
			text,
			ticker,
			title,
		} = await this.getPropertiesOfInterface('', 'org.kde.kdeconnect.device.notifications.notification')
		this.appName = appName
		this.dismissable = dismissable
		this.hasIcon = hasIcon
		this.silent = silent
		this.text = text
		this.ticker = ticker
		this.ticker = title

		Object.freeze(this)
	}

	async dismiss() {
		if (!this.dismissable) {
			return false
		}

		const i = await this.getInterface('', 'org.kde.kdeconnect.device.notifications.notification')
		i.dismiss()

		return true
	}
}

interface eKDEMediaHandler {
	'onMediaPlayerUpdated': () => void
}

class KDEMediaHandler extends KDEBase {
	events = new EventEmitter<eKDEMediaHandler>()

	private _volume!: number
	private _length!: number
	private _isPlaying!: boolean
	private _position!: number
	private _player!: string
	private _nowPlaying!: string
	private _title!: string
	private _artist!: string
	private _album!: string
	private _canSeek!: boolean

	get volume() { return this._volume }
	get length() { return this._length }
	get isPlaying() { return this._isPlaying }
	get position() { return this._position }
	get player() { return this._player }
	get nowPlaying() { return this._nowPlaying }
	get title() { return this._title }
	get artist() { return this._artist }
	get album() { return this._album }
	get canSeek() { return this._canSeek }

	mediaDataLoaded: Promise<void>

	protected async getProxyObject() {
		return await super.getProxyObject('mprisremote')
	}

	constructor(id: string, bus = sessionBus()) {
		super(id, bus)
		this.mediaDataLoaded = this.init()
	}

	Next!: () => Promise<void>
	Previous!: () => Promise<void>
	Pause!: () => Promise<void>
	PlayPause!: () => Promise<void>
	Stop!: () => Promise<void>
	Play!: () => Promise<void>

	private createRunCommandFun(i: ClientInterface, str: string) {
		return async () => await i.sendAction(str)
	}

	private async init() {
		await this.retrieveData()
		const i = await this.getInterface('', 'org.kde.kdeconnect.device.mprisremote')
		i.on('propertiesChanged', this.retrieveData.bind(this))
		this.Next = this.createRunCommandFun(i, 'Next')
		this.Previous = this.createRunCommandFun(i, 'Previous')
		this.Pause = this.createRunCommandFun(i, 'Pause')
		this.PlayPause = this.createRunCommandFun(i, 'PlayPause')
		this.Stop = this.createRunCommandFun(i, 'Stop')
		this.Play = this.createRunCommandFun(i, 'Play')
	}

	private async retrieveData() {
		const {
			volume,
			length,
			isPlaying,
			position,
			player,
			nowPlaying,
			title,
			artist,
			album,
			canSeek,
		} = await this.getPropertiesOfInterface('', 'org.kde.kdeconnect.device.mprisremote')

		this._volume = volume
		this._length = length
		this._isPlaying = isPlaying
		this._position = position
		this._player = player
		this._nowPlaying = nowPlaying
		this._title = title
		this._artist = artist
		this._album = album
		this._canSeek = canSeek
		this.events.emit('onMediaPlayerUpdated')
	}
}

interface eKDEDevice {
	'onTrustedChanged': (v: boolean) => void
	'onNameChanged': (v: string) => void
	'onTypeChanged': (v: string) => void
	'onReachableChanged': (v: boolean) => void
	'onBatteryChanged': (v: iKDEDeviceBattery) => void
	'onConnectivityChanged': (v: iKDEDeviceConnectivity) => void
	'onChanged': () => void
}

interface iKDEDeviceBattery {
	charge: number,
	charging: boolean
}

interface iKDEDeviceConnectivity {
	type: string,
	strength: number
}

class KDEDevice extends KDEBase {
	events = new EventEmitter<eKDEDevice>()

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

	constructor(id: string, bus = sessionBus()) {
		super(id, bus)
		this._id = id
		this._bus = bus
	}


	private wrapCheckDeorator<T extends (...a: any[]) => any>(fun: T): T {
		return ((...a: any[]) => {
			this.wrapCheckSetup()
			return fun(...a)
		}) as T
	}

	private wrapCheckSetup() {
		if (!this._setupDone) {
			throw new Error('KDEDevice was not setup. Please call .setup()')
		}
		if (!this._isReachable) {
			throw new Error('Cannot connect to KDEDevice!')
		}

		return Promise.resolve()
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
		{
			const {
				isReachable,
				isTrusted,
				name,
				type
			} = await this.getPropertiesOfInterface('', 'org.kde.kdeconnect.device')
			this._isReachable = isReachable
			this._isTrusted = isTrusted
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
				}
				this.events.emit('onReachableChanged', i)
			})
			interf.on('trustedChanged', i => {
				this._isTrusted = i
				this.events.emit('onTrustedChanged', i)
			})
			interf.on('nameChanged', i => {
				this._name = i
				this.events.emit('onNameChanged', i)
			})
			interf.on('typeChanged', i => {
				this._type = i
				this.events.emit('onTypeChanged', i)
			})
		}

		if (this.isReachable) {
			await this.iSetup()
		}

		this._setupDone = true
	}

	async getNotifications() {
		this.wrapCheckSetup()
		const interf = await this.getInterface('notifications', 'org.kde.kdeconnect.device.notifications')
		const av = await interf.activeNotifications() as number[]

		const r = av.map(i => new KDENotification(this.id, i, this._bus))

		await Promise.all(r.map(i => i.notificationDataLoaded))

		return r
	}

	async shareFile(pathToFile: string) {
		this.wrapCheckSetup()
		this.shareURL(`file://${path.resolve(pathToFile)}`)
	}

	async getMediaControl() {
		this.wrapCheckSetup()
		const n = new KDEMediaHandler(`/modules/kdeconnect/devices/${this.id}`, this._bus)
		await n.mediaDataLoaded
		return n
	}

	ring: () => Promise<void> = this.wrapCheckSetup
	ping: (msg?: string) => Promise<void> = this.wrapCheckSetup
	shareURL: (url: string) => Promise<void> = this.wrapCheckSetup
	shareText: (text: string) => Promise<void> = this.wrapCheckSetup // to clipboard
}

export async function getAvailableDevices() {
	const bus = sessionBus()
	const obj = await bus.getProxyObject('org.kde.kdeconnect.daemon', '/modules/kdeconnect/devices')
	const dev = obj.nodes.map(i => new KDEDevice(i.slice(i.lastIndexOf('/') + 1), bus))
	for(const i of dev){
		await i.setup()
	}

	return dev
}

getAvailableDevices()