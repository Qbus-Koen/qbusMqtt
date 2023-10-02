module.exports = function(RED) {
    class QbusWeatherNode {
        constructor(n) {
            RED.nodes.createNode(this,n);

            var node = this
            node.config = n;

            node.client = node.config.client
            node.clientConn = RED.nodes.getNode(node.client) 

            if (node.clientConn != null) {
                node.server     = node.clientConn.server
                node.serverConn = RED.nodes.getNode(node.server) 

                node.qid = node.config.qid
                node.ctdQid = node.clientConn.ctdQid

                node.listener_onMQTTMessage = function(data) { node.onMQTTMessage(data); }
                node.serverConn.on('onMQTTMessage', node.listener_onMQTTMessage);

                node.listener_onStateUpdate = function(state, qid) { node.onStateUpdate(state, qid); }
                node.clientConn.on('onStateUpdate', node.listener_onStateUpdate);

                if (node.serverConn){
                    subscribe()
                    requestState()

                    node.on('close', function(done) {
                        done();
                    })
                } 

                function requestState() {
                    var devs = []
                    devs.push(node.qid)
                    var cmd = JSON.stringify(devs);
                    var topic = "cloudapp/QBUSMQTTGW/getState"

                    node.serverConn.mqtt.publish(topic, cmd,
                            {'qos':parseInt(node.serverConn.config.mqtt_qos||0)},
                            function(err) {
                                if (err) {
                                    node.error(err);
                                }
                    });
                }

                function subscribe() {
                    node.serverConn.subscribeMQTT("cloudapp/QBUSMQTTGW/" + node.ctdQid + "/" + node.qid + "/state")
                    node.serverConn.subscribeMQTT("cloudapp/QBUSMQTTGW/" + node.ctdQid + "/" + node.qid + "/event")
                }
            }else {
                node.status({fill:"red", shape:"dot", text:"No controller configured."})
            }
        }

        onStateUpdate(state) {
            var node = this;
            var  msg = {}
            msg.payload = state.payload;
            
            if (state.state === true){
                node.status({fill:"green", shape:"dot", text:"Connected."});
            } else if (state.payload == "No connection with MQTT Server"){
                node.status({fill:"red", shape:"dot", text:"No connection with MQTT Server."});
            } else if (state.payload == "Connected with MQTT Server"){
                node.status({fill:"red", shape:"dot", text:"Connected with MQTT Server."});
            } else if (state.state === false){
                node.status({fill:"red", shape:"dot", text:"No connection with controller."});
            }
        }
    
        onMQTTMessage(topic, message) {
            var node = this;
            var pl = JSON.parse(topic.payload)
            var  msg = {}
            if (node.qid === pl.id) {
                if (pl.properties.hasOwnProperty("temperature")){
                    msg.topic = "temperature"
                    msg.payload = pl.properties.temperature;
                    node.status({fill:"green", shape:"ring", text:"Current temp: " + msg.payload})
                } else if (pl.properties.hasOwnProperty("dayLight")){
                    msg.topic = "dayLight"
                    msg.payload = pl.properties.dayLight;
                    node.status({fill:"green", shape:"ring", text:"Daylight: " + msg.payload})
                } else if (pl.properties.hasOwnProperty("light")){
                    msg.topic = "light"
                    msg.payload = pl.properties.light;
                    node.status({fill:"green", shape:"ring", text:"Light: " + msg.payload})
                } else if (pl.properties.hasOwnProperty("lightEast")){
                    msg.topic = "lightEast"
                    msg.payload = pl.properties.lightEast;
                    node.status({fill:"green", shape:"ring", text:"Light East: " + msg.payload})
                } else if (pl.properties.hasOwnProperty("lightSouth")){
                    msg.topic = "lightSouth"
                    msg.payload = pl.properties.lightSouth;
                    node.status({fill:"green", shape:"ring", text:"Light South: " + msg.payload})
                } else if (pl.properties.hasOwnProperty("lightWest")){
                    msg.topic = "lightWest"
                    msg.payload = pl.properties.lightWest;
                    node.status({fill:"green", shape:"ring", text:"Light West: " + msg.payload})
                } else if (pl.properties.hasOwnProperty("raining")){
                    msg.topic = "raining"
                    msg.payload = pl.properties.raining;
                    node.status({fill:"green", shape:"ring", text:"Raining: " + msg.payload})
                } else if (pl.properties.hasOwnProperty("twilight")){
                    msg.topic = "twilight"
                    msg.payload = pl.properties.twilight;
                    node.status({fill:"green", shape:"ring", text:"Twilight: " + msg.payload})
                } else if (pl.properties.hasOwnProperty("wind")){
                    msg.topic = "wind"
                    msg.payload = pl.properties.wind;
                    node.status({fill:"green", shape:"ring", text:"Wind: " + msg.payload})
                }
                node.send(msg);
            }
        }
}
    RED.nodes.registerType("qbus-weather",QbusWeatherNode);
}