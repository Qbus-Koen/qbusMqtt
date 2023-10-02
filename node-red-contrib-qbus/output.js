module.exports = function(RED) {
    RED.httpAdmin.get("/static/*", function (req, res) {
        var options = {
          root: __dirname + "/static/",
          dotfiles: "deny",
        };
        res.sendFile(req.params[0], options);
      });

      

    function Ctds(sn, id, client) {
        this.sn = sn
        this.id = id
        this.client = client
    }

    function Output(id, name, type) {
        this.id = id;
        this.name = name;
        this.type = type;
    }

    GetCtds = function(devices) {
        var ctds = new Array();
        for (i = 0; i < devices.length; i++) {
            ctds.push(new Ctds(devices[i].ctdSn, devices[i].id, devices[i].client))
        }
        return ctds
    }

    getOutputs = function(devices, ctd){
        var output = []
        if (ctd != null && devices != null) {
            // Loop over devices
            var i = 0;
            for (i = 0; i < devices.length; i++) {
                // Only get outputs from device.Serial = selected ctd serial
                //console.log('Getting outputs ' + ctd + ' - ' + type)
                if (ctd == devices[i].id){
                    // Get outputs
                    var outputs = devices[i].outputArray
                    
                    // Loop over outputs
                    var j=0
                    for (j = 0; j < outputs.length; j++) {
                        output.push(new Output(outputs[j].id, outputs[j].name, outputs[j].type))
                    }
                }
            }
        }
        return output
    }
    outputList = []
   

    class QbusOutputNode {
       
        constructor(n) {
            RED.nodes.createNode(this,n);

            var node = this
            node.config = n;

            node.mqttClient = node.config.client

            node.connected = false
            node.connectable = false

            if (node.mqttClient) {
                node.clientconn = RED.nodes.getNode(node.mqttClient)
                if (node.clientconn != null) {
                    node.ctdid = node.config.selCtdUL
                    node.name = node.config.selOutputName
                    node.outputarray = node.config.selOutputs
                    node.type = node.config.typeO
                    node.ctdSn = node.config.selCtdSn

                    node.globalContext = node.context().global;
                    var devices = node.globalContext.get("devices")

                    // Get outputs 
                    var outps = []
                    outps = getOutputs(devices, node.ctdid);
                    outputList = outps
                    //node.globalContext.set("outputs",outps)

                    // Send controller list to html dropdownbox
                    RED.httpAdmin.get("/qbus-client/ctds",  function(req, res) {
                        // Get all controllers
                        node.globalContext = node.context().global;
                        var devs = node.globalContext.get("devices")
                        var ctds = GetCtds(devs)
                        res.json(ctds);
                    });

                    // Send output list to html dropdownbox
                    RED.httpAdmin.get("/qbus-client/outputs", function(req, res) {
                        var ctd = req.query.ctd
                        
                        // Get all devices
                        node.globalContext = node.context().global;
                        var devices = node.globalContext.get("devices")

                        outps = getOutputs(devices, ctd, "");
                        outputList = outps
                        res.json(outps);
                    });

                    // Send connected state to html
                    RED.httpAdmin.get("/qbus-client/connectable", function(req, res) {
                        var ctd = req.query.ctd
                        var devices = node.globalContext.get("devices")
                        var conn = false
                        for (j = 0; j < devices.length; j++) {
                            if (devices[j].id == ctd) {
                                conn = devices[j].connectable
                            }
                        }
                        res.json({'connectable': conn})
                    });

                    // Activate controller
                    RED.httpAdmin.get("/qbus-client/activate", function(req, res) {
                        //msg.state = false
                        //msg.payload = "CTD " + node.selCtd + " NOT READY FOR MQTT - UPDATING FIRMWARE..."
                        var ctd = req.query.ctd

                        var cmd = {"id":ctd,"type":"action","action":"activate","properties":{"authKey": "ubielite"}}
                        var topic = "cloudapp/QBUSMQTTGW/" + ctd + "/setState";

                        node.clientconn.mqtt.publish(topic, JSON.stringify(cmd),
                                {'qos':parseInt(node.clientconn.config.mqtt_qos||0)},
                                function(err) {
                                    if (err) {
                                        node.error(err);
                                    }
                        });

                    });

                    if (node.ctdid && node.outputarray) {
                        //node.log(node.ctdid)
                        node.listener_onMQTTMessage = function(data) { node.onMQTTMessage(data); }
                        node.clientconn.on('onMQTTMessage', node.listener_onMQTTMessage);

                        //subscribe to controller states
                        node.clientconn.subscribeMQTT("cloudapp/QBUSMQTTGW/" + node.ctdid + "/state")

                        
                        var items = []
                        items = node.outputarray

                        // Subscribe to output states and events
                        items.forEach(loopOutputIds)

                        function loopOutputIds(item, index, arr) {
                            subscribe(arr[index]);

                        }

                        requestState(items)

                        node.on("input", function(msg) {
                            var items = []
                            var type = node.type
                            
                            items = node.outputarray

                            items.forEach(loopOutputIds)

                            function loopOutputIds(item, index, arr) {
                                
                                var cmd = ""
                                var topic = ""

                                if (type == 'scene') {
                                    cmd = '{"id":"' + arr[index] + '","type":"action","action":"active"}'
                                    topic = "cloudapp/QBUSMQTTGW/" + node.ctdid + "/" + arr[index] + "/setState"
                                //} //else if (type == 'thermo') {
                                   // cmd = '{"id":"' + arr[index] + '","type":"action","action":"active"}'
                                   // topic = "cloudapp/QBUSMQTTGW/" + node.ctdid + "/" + arr[index] + "/setState"
                                } else {
                                    topic = "cloudapp/QBUSMQTTGW/" + node.ctdid + "/" + arr[index] + "/setState"
                                    if (typeof msg.payload == "string") {
                                        cmd = '{"id":"' + arr[index] + '","type":"state","properties":{"' + msg.topic + '":"' + msg.payload + '"}}'
                                    } else {
                                        cmd = '{"id":"' + arr[index] + '","type":"state","properties":{"' + msg.topic + '":' + msg.payload + '}}'
                                        
                                    }
                                }

                                
                                node.clientconn.mqtt.publish(topic, cmd,
                                        {'qos':parseInt(node.clientconn.config.mqtt_qos||0)},
                                        function(err) {
                                            if (err) {
                                                node.error(err);
                                            }
                                });
                            }
                        })

                        node.on('close', function(done) {
                            done();
                        })

                        function requestState(devs) {
                            var cmd = JSON.stringify(devs);
                            var topic = "cloudapp/QBUSMQTTGW/getState"
            
                            node.clientconn.mqtt.publish(topic, cmd,
                                    {'qos':parseInt(node.clientconn.config.mqtt_qos||0)},
                                    function(err) {
                                        if (err) {
                                            node.error(err);
                                        }
                            });
                        }
            
                        function subscribe(outputid) {
                            node.clientconn.subscribeMQTT("cloudapp/QBUSMQTTGW/" + node.ctdid + "/" + outputid + "/state")
                            node.clientconn.subscribeMQTT("cloudapp/QBUSMQTTGW/" + node.ctdid + "/" + outputid + "/event")
                        }
                    }
                } else {
                    RED.httpAdmin.get("/qbus-client/ctds",  function(req, res) {
                        res.json({});
                    });
                    RED.httpAdmin.get("/qbus-client/outputs", function(req, res) {
                        res.json({});
                    });
                }
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
            let node = this;
            let pl = JSON.parse(topic.payload)
            //console.log(topic)
            let  msg = {}
            var top = topic.topic



            if (node.outputarray.includes(pl.id) ) {
                node.globalContext = node.context().global;
                msg.topic = pl.type;
                let outps = outputList
                let obj = outps.find(o => o.id === pl.id);
                try {
                    msg.name = obj.name
                    msg.outputId = pl.id;
                    msg.ctdId = node.ctdid;
                    msg.ctdSn = node.ctdSn;
                    msg.payload = pl.properties;
                    node.status({fill:"green", shape:"ring", text:"Connected"});
                    node.send(msg);
                } catch {
                    node.log("error")
                }

                //node.log(obj)

                
            }
        }

        

}
    RED.nodes.registerType("qbus-output",QbusOutputNode);
}