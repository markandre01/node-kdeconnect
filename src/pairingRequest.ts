import { MessageBus } from "dbus-next"
import { KDEDevice } from "./device"
import { basicWrapCheckDeorator } from "./errorTypes"

export class KDEPairingRequest {
    device: KDEDevice
    private _bus: MessageBus

    pairingRequestDetupDone: Promise<void>

    private async getProxyObject() {
        return await this._bus.getProxyObject('org.kde.kdeconnect.daemon', `/modules/kdeconnect/devices/${this.device.id}`)
    }

    private async getInterface(name: string) {
        return (await this.getProxyObject()).getInterface(name)
    }

    constructor(base: KDEDevice, bus: MessageBus) {
        this.device = base
        this._bus = bus
        this.pairingRequestDetupDone = this.setup()
    }

    Accept!: () => Promise<void>
    Reject!: () => Promise<void>

    private async setup() {
        const interf = await this.getInterface('org.kde.kdeconnect.device')
        this.Reject = basicWrapCheckDeorator(this.device, interf.rejectPairing as any)
        this.Accept = basicWrapCheckDeorator(this.device, interf.acceptPairing as any)
    }
}
