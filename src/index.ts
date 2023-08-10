import { sessionBus } from 'dbus-next'
import { KDEDevice } from './device'

export {KDEDevice}
export async function getAvailableDevices() {
	const bus = sessionBus()
	const obj = await bus.getProxyObject('org.kde.kdeconnect.daemon', '/modules/kdeconnect/devices')
	const dev = obj.nodes.map(i => new KDEDevice(i.slice(i.lastIndexOf('/') + 1), bus))
	for (const i of dev) {
		await i.setup()
	}

	return dev
}