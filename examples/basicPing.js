const {getAvailableDevices} = require("kdeconnect")

async function main(){
    let devices = await getAvailableDevices()
    let myDevice = devices[0]
    
    console.log(`Device Name: ${myDevice.name}`)
    console.log(`Device Type: ${myDevice.type}`)
    console.log(`Device is Reachable: ${myDevice.isReachable}`)
    
    if(myDevice.isReachable && myDevice.isTrusted){
        myDevice.ping("hello from node js!")
    }
}

main()