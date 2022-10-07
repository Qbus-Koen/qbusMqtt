module.exports = function(RED) {

    function Ctds(sn, id) {
        this.sn = sn
        this.id = id
    }

    function Output(id, name) {
        this.id = id;
        this.name = name;
    }

    GetCtds = function(devices) {
        var ctds = new Array();
        for (i = 0; i < devices.length; i++) {
            ctds.push(new Ctds(devices[i].ctdSn, devices[i].id))
        }
        return ctds
    }

    getOutputs = function(devices, ctd, type){
        var output = []
        if (ctd != null && devices != null) {
            // Loop over devices
            var i = 0;
            for (i = 0; i < devices.length; i++) {
                // Only get outputs from device.Serial = selected ctd serial
                if (ctd == devices[i].ctdSn){
                    // Get outputs
                    var outputs = devices[i].outputArray
                    
                    // Loop over outputs
                    var j=0
                    for (j = 0; j < outputs.length; j++) {
                        // If output is bistabiel, then append to list
                        if (outputs[j].type === type){
                            output.push(new Output(outputs[j].id, outputs[j].name))
                        }
                    }
                }
            }
        }
        return output
    }


    class QbusClientNode {
        constructor(n){
            RED.nodes.createNode(this,n);

            var node = this;
            node.config = n;
    
            node.server     = node.config.server
            node.serverConn = RED.nodes.getNode(node.server) 

            node.ctdQid = node.config.ctdQid
            node.selCtd = node.config.ctdSn
            node.ctd = node.config.ctdSn

            node.ctdConnectable = false

            node.globalContext = node.context().global;

            node.listener_onMQTTMessage = function(data) { node.onMQTTMessage(data); }
            node.serverConn.on('onMQTTMessage', node.listener_onMQTTMessage);

            node.listener_onConnectError = function(data) { node.onConnectError(data); }
            node.serverConn.on('onConnectError', node.listener_onConnectError);

            node.listener_onMQTTConnect = function(data) { node.onMQTTConnect(data); }
            node.serverConn.on('onMQTTConnect', node.listener_onMQTTConnect);

            node.serverConn.subscribeMQTT("cloudapp/QBUSMQTTGW/" + node.ctdQid + "/state")

            // Send controllers list to html dropdownbox
            RED.httpAdmin.get("/qbus-client/ctds", RED.auth.needsPermission('ohinput.read'), function(req, res) {
                // Get all controllers
                node.globalContext = node.context().global;
                var devs = node.globalContext.get("devices")
                
                var ctds = GetCtds(devs)
            // RED.log.debug("qbus.js - ctd's: " + ctds[0].sn);
                res.json(ctds);
            });

            // Send output list to html dropdownbox
            RED.httpAdmin.get("/qbus-client/output", RED.auth.needsPermission('ohinput.read'),  function(req, res) {
                var ctd = req.query.ctd
                var type = req.query.type

                var outps = []
                // Get all devices
                node.globalContext = node.context().global;
                var devices = node.globalContext.get("devices")
                // Get outputs by type
                outps = getOutputs(devices, ctd, type);
                res.json(outps);
            });

            node.onStateUpdate = function(state) {
                node.emit('onStateUpdate', state);
            }
        }

        onMQTTMessage(topic, message) {
            var node = this;
            var ms = topic.payload
            var top = topic.topic

            if (top.includes(node.ctdQid + "/state")) {
                var connectionState = JSON.parse(ms)
                var connectable = connectionState.properties.connectable
                var connected = connectionState.properties.connected

                var  msg = {}

                if (connected === false) {
                    msg.state = false
                    msg.payload = "CTD " + node.selCtd + " IS CONNECTED WITH SMIII";
                }

                if (connected === true) {
                    msg.state = true
                    msg.payload = "CTD " + node.selCtd + " IS ONLINE";
                }

                if (connectable === false) {
                    setTimeout(() => {
                        if (node.ctdConnectable === false) {
                            msg.state = false
                            msg.payload = "CTD " + node.selCtd + " NOT READY FOR MQTT - UPDATING FIRMWARE..."
                            var cmd = {"id":node.ctdQid,"type":"action","action":"activate","properties":{"authKey": "ubielite"}}
                            var topic = "cloudapp/QBUSMQTTGW/" + node.ctdQid + "/setState";

                            node.serverConn.mqtt.publish(topic, JSON.stringify(cmd),
                                    {'qos':parseInt(node.serverConn.config.mqtt_qos||0)},
                                    function(err) {
                                        if (err) {
                                            node.error(err);
                                        }
                            });
                        }
                      }, 1000);
                } else if (connectable == true) {
                    node.ctdConnectable = true;
                }

                node.onStateUpdate(msg);
                
            }
        }

        onConnectError() {
            var node = this;
            var  msg = {};
            msg.state = false
            msg.payload = "No connection with MQTT Server";
            node.onStateUpdate(msg);
        }

        onMQTTConnect() {
            var node = this;
            var  msg = {};
            msg.state = false
            msg.payload = "Connected with MQTT Server";
            node.onStateUpdate(msg);
        }
    }

    RED.nodes.registerType("qbus-client",QbusClientNode);
}        