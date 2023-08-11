import { ClientInterface, MessageBus, Variant, sessionBus } from 'dbus-next';
import EventEmitter from 'eventemitter3';
import { KDEDevice } from './device';
import { checkSetup } from './errorTypes';

interface eKDEMediaHandler {
    'onMediaPlayerUpdated': () => void
}

export class KDEMediaHandler {
	events = new EventEmitter<eKDEMediaHandler>()
	device: KDEDevice

	private _bus: MessageBus
	private _volume?: number
	private _length?: number
	private _isPlaying?: boolean
	private _position?: number
	private _player?: string
	private _nowPlaying?: string
	private _title?: string
	private _artist?: string
	private _album?: string

	get length() { return this._length }
	get volume() { return this._volume }
	get isPlaying() { return this._isPlaying }
	get position() { return this._position }
	get player() { return this._player }
	get nowPlaying() { return this._nowPlaying }
	get title() { return this._title }
	get artist() { return this._artist }
	get album() { return this._album }

	checkSetup() {
		return checkSetup(this.device)
	}

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
		return await this._bus.getProxyObject('org.kde.kdeconnect.daemon', `/modules/kdeconnect/devices/${this.device.id}/mprisremote`)
	}

	constructor(base: KDEDevice, bus = sessionBus()) {
		this.device = base
		this._bus = bus
		this.device.events.on('onReachableChanged', val => { if (val) this.init() })
		this.device.events.on('onTrustedChanged', val => { if (val) this.init() })

		if (this.device.isTrusted && this.device.isReachable) {
			this.init()
		}
	}

	Next: () => Promise<void> = this.checkSetup
	Previous: () => Promise<void> = this.checkSetup
	Pause: () => Promise<void> = this.checkSetup
	PlayPause: () => Promise<void> = this.checkSetup
	Stop: () => Promise<void> = this.checkSetup
	Play: () => Promise<void> = this.checkSetup

	private createRunCommandFun(i: ClientInterface, str: string) {
		return async () => {
			await this.checkSetup();
			await i.sendAction(str)
		}
	}

	private interface?: ClientInterface
	private async init() {
		await this.update()

		this.interface?.off('propertiesChanged', this.retrieveDataBinding)
		const i = this.interface = await this.getInterface('org.kde.kdeconnect.device.mprisremote')
		i.on('propertiesChanged', this.retrieveDataBinding)
		this.Next = this.createRunCommandFun(i, 'Next')
		this.Previous = this.createRunCommandFun(i, 'Previous')
		this.Pause = this.createRunCommandFun(i, 'Pause')
		this.PlayPause = this.createRunCommandFun(i, 'PlayPause')
		this.Stop = this.createRunCommandFun(i, 'Stop')
		this.Play = this.createRunCommandFun(i, 'Play')
	}

	private retrieveDataBinding = this.update.bind(this)
	async update() {
		await this.checkSetup()

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
		} = await this.getPropertiesOfInterface('org.kde.kdeconnect.device.mprisremote')

		this._volume = volume
		this._length = length
		this._isPlaying = isPlaying
		this._position = position
		this._player = player
		this._nowPlaying = nowPlaying
		this._title = title
		this._artist = artist
		this._album = album
		this.events.emit('onMediaPlayerUpdated')
	}

	clear() {
		this._volume = undefined
		this._length = undefined
		this._isPlaying = undefined
		this._position = undefined
		this._player = undefined
		this._nowPlaying = undefined
		this._title = undefined
		this._artist = undefined
		this._album = undefined
		this.events.emit('onMediaPlayerUpdated')
	}
}
