import { KDEDevice } from './device'

class KDE_InvalidObjectError extends Error {
	constructor(msg?: string) {
		super(msg)
	}
}

class KDE_DeviceNotReachableError extends Error {
	constructor(msg?: string) {
		super(msg)
	}
}

class KDE_DeviceNotTrustedError extends Error {
	constructor(msg?: string) {
		super(msg)
	}
}

export function basicCheckSetup(base: KDEDevice) {
	if (!base.setupDone) {
		throw new KDE_InvalidObjectError('KDEDevice was not setup. Please call .setup()')
	}
	if (!base.isReachable) {
		throw new KDE_DeviceNotReachableError('Cannot connect to KDEDevice!')
	}

	return Promise.resolve()
}

export function checkSetup(base: KDEDevice) {
	basicCheckSetup(base)

	if (!base.isTrusted) {
		throw new KDE_DeviceNotTrustedError('KDEDevicey not trusted!')
	}

	return Promise.resolve()
}

export function basicWrapCheckDeorator<T extends (...a: any[]) => any>(base: KDEDevice, fun?: T): T {
	return ((...a: any[]) => {
		basicCheckSetup(base)
		return fun?.(...a)
	}) as T
}

export function wrapCheckDeorator<T extends (...a: any[]) => any>(base: KDEDevice, fun?: T): T {
	return ((...a: any[]) => {
		checkSetup(base)
		return fun?.(...a)
	}) as T
}