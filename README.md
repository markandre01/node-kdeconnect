# KDE Connect Bindings for NodeJS

Small script using [DBus](https://github.com/dbusjs/node-dbus-next) to allow a NodeJS application to communicate with connected devices via KDE Connect

## Requirements

- DBus support
    - NodeJS >= 10.8.0
    - Linux Desktop with DBus Support
- KDE Connect installed and running

## API

The API is written fully in Typescript, so check out the declaration file for additional infos

### Device Retrieving and Basic Information

#### `async getAvailableDevices()`

Returns a list of KDEDevices currently known or available

#### `class KDEDevice`

Can be manually created or retrieved using `getAvailableDevices`

##### Constructor

`KDEDevice(id, bus)`

|Name|Type|Info|
|----|----|----|
|id | `string` | KDE ID, can be stored from old device or retrieved manually|
|bus | `MessageBus` | optional, DBus-Session to use|


##### Properties

|Name|Type|Info|
|----|----|----|
|id | `string` | KDE ID |
|name | `string` | Device Name |
|type | `string` | `smartphone` | `desktop` |
|isReachable | `boolean` | Is device currently reachable |
|isTrusted | `boolean` | Is device trusted |
|connectivity | `{type: string, strength: number}` | cellular data (not wifi) |
|battery | `{charge: number, charging: boolean}` | battery status |

##### Functions

|Signature|Info|
|---|----|
|`async setup(): Promise<void>`|if a device is manually created, using its KDE ID, this must be called befor use|
|`async shareFile(filePath: string): Promise<void>`|Shares the file from file path with the device (copying it to the previously chosen folder on the device)|
|`async shareURL(urL: string): Promise<void>`|Shares the url with the device, either as a notification or by directly opening the link|
|`async shareText(text: string): Promise<void>`|Shares the text with the device, normally copying it into the devices clipboard|
|`async ring(): Promise<void>`|Let`s the device ring|
|`async ping(msg?: string): Promise<void>`|Sends a notification with an optional message to the device|
|`async getNotifications(): Promise<KDENotification[]>`|Returns a list of notifications currently present on the device. See below|
|`async getMediaControl(): Promise<KDEMediaHandler>`|Returns a separate handler for media control. See below|

##### Events

Every device has an event handler linked to it, accessible by the `events` Property.

|Event|Values|
|---|---|
|`onTrustedChanged`| `(boolean)`
|`onNameChanged`| `(string)`
|`onTypeChanged`| `(string)`
|`onReachableChanged`| `(boolean)`
|`onBatteryChanged`| `({charge: number, charging: boolean})`
|`onConnectivityChanged`| `({type: string, strength: number})`

#### `class KDENotification`

##### Constructor
Not externally accessible

##### Properties

|Name|Type|Info|
|----|----|----|
|appName|string|App origin name|
|dismissable|boolean|Is this message dismissable|
|silent|boolean|Is it a silent message|
|text|string|Message text|
|ticker|string|Message short version|
|title|string|Message title|

##### Functions

|Signature|Info|
|---|----|
|`async dismiss(): Promise<boolean>`|Dismisses message on device. Returns `true` if message is dismissable, `false` otherwise|
##### Events
No events


#### `class KDEMediaHandler`

##### Constructor
Not externally accessible

##### Properties

|Name|Type|Info|
|----|----|----|
|length|number|length of currently playing track in ms|
|position|number|already passed time of currently playing track in ms|
|volume|number|device volume in %|
|isPlaying|boolean|is music playing or paused|
|player|string|name of currently playing app|
|nowPlaying|string|name & artist of track|
|title|string|track title|
|artist|string|track artist name|
|album|string|track album name|
|canSeek|boolean|true, if track can be fast forwarded/backwarded|

##### Functions

|Signature|Info|
|---|----|
|`async Next(): Promise<void>`|Play next track|
|`async Previous(): Promise<void>`|Play previous track / Jump to start of current track|
|`async Play(): Promise<void>`|Play track|
|`async Pause(): Promise<void>`|Pause track|
|`async PlayPause(): Promise<void>`|Switch Between Play/Pause|
|`async Stop(): Promise<void>`|Stop track|
|`async update(): Promise<void>`|Manually update data; Use to keep track of `position`|

##### Events

|Event|Values|Info
|---|---|---|
|`onMediaPlayerUpdated`| `()` | Called when any data changes. Can fire multiple times in succession; Does NOT fire when `position` changes|
