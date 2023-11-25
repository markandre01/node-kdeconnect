const { getAvailableDevices } = require("kdeconnect")

// convert to two digit string
function msToMinutesSeconds(ms) {
    let d = new Date(ms)
    let minutes = d.getMinutes().toLocaleString("en-US", { minimumIntegerDigits: 2 })
    let seconds = d.getSeconds().toLocaleString("en-US", { minimumIntegerDigits: 2 })
    return `${minutes}:${seconds}`
}

async function main() {
    let devices = await getAvailableDevices()
    let myDevice = devices[0]

    console.log(`Device Name: ${myDevice.name}`)

    if (!myDevice.isReachable || !myDevice.isTrusted) {
        console.log(`Device is not reachable or trusted!`)
        return
    }

    myDevice.media.events.on("onMediaPlayerUpdated", () => {
        let progressString = `${msToMinutesSeconds(myDevice.media.position)} / ${msToMinutesSeconds(myDevice.media.length)}`
        process.stdout.clearLine()
        process.stdout.write(`\r${myDevice.media.isPlaying ? "⏵" : "⏸"} ${myDevice.media.nowPlaying} ${progressString}`)
    })

    myDevice.media.update()

    // Play progress is not updated automatically, so add a polling function here
    // This could be enhanced by clearing the interval upon pausing
    setInterval(() => {
        if (myDevice.media.isPlaying) {
            myDevice.media.update()
        }
    }, 1000)
}

main()

