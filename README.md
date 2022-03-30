# qbusMqttGw

This is the repository for the Qbus Mqtt Gateway application.
With this application you can communicate with all Qbus CTD controller over an MQTT server.

## How to use
The software requires a tftp client and a MQTT server.
On Linux (raspberry) you can install a tftp client with:
`sudo apt-get install -y tftp`

And if you don't have a MQTT server, we recommand using Mosquitto:
`sudo apt-get install -y mosquitto`

### Setting up Mosquitto
For security reasons, we recommend setting up a user with password on the Mosquitto server. You can create a login with the following command:

`sudo mosquitto_passwd -c /etc/mosquitto/pass <username>`

Then enter and reenter a password.

Next you have to edit the moquitto configuration file to use this passord.
The conf file is located at /etc/mosquitto/mosquitto.conf
  
```
# Place your local configuration in /etc/mosquitto/conf.d/
#
# A full description of the configuration file is at
# /usr/share/doc/mosquitto/examples/mosquitto.conf.gz

pid_file /run/mosquitto/mosquitto.pid

persistence true
persistence_location /var/lib/mosquitto/

log_dest file /var/log/mosquitto/mosquitto.log

include_dir /etc/mosquitto/conf.d

per_listener_settings true
allow_anonymous false
password_file /etc/mosquitto/pass
```
  
Then restart mosquitto to apply the changes:

`sudo systemctl restart mosquitto`

### Setting up Qbus MQTT client
First we need to unzip the tar files (this example uses the arm version, if you are installing on a Linux machine, use the correct version - x86 / x64):

`tar -xf qbusMqtt/qbusMqtt/qbusMqttGw/qbusMqttGw-arm.tar`

Then we create the locations needed for the software:
```
sudo mkdir /usr/bin/qbus
sudo mkdir /opt/qbus
```

And copy the files to the correct locations:

```
sudo cp -R qbusMqtt/qbusMqtt/qbusMqttGw/qbusMqttGw-arm/fw/ /opt/qbus/
sudo cp qbusMqtt/qbusMqtt/qbusMqttGw/qbusMqttGw-arm/puttftp /opt/qbus/
sudo cp qbusMqtt/qbusMqtt/qbusMqttGw/qbusMqttGw-arm/qbusMqttGw /usr/bin/qbus/
```
Make files executable:
```
sudo chmod +x /usr/bin/qbus/qbusMqttGw
sudo chmod +x /opt/qbus/puttftp
```

To use the client, we recomment to use a service.
Create a new file:

`/lib/systemd/system/qbusmqtt.service`

And enter the following:
```
[Unit]
Description=MQTT client for Qbus communication
After=multi-user.target networking.service

[Service]
ExecStart= /usr/bin/qbus/./qbusMqttGw -serial="QBUSMQTTGW" -daemon true -logbuflevel -1 -logtostderr true -storagedir /opt/qbus -mqttbroker "tcp://localhost:1883" -mqttuser <user> -mqttpassword <password>
PIDFile=/var/run/qbusmqttgw.pid
Restart=on-failure
RemainAfterExit=no
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

If your Mqtt broker is on another device, change "tcp://localhost:1883".  
Replace \<user\> and \<password\> by you mosquitto credentials.


Now it's time to reload the servies:

`sudo systemctl daemon-reload`

Enable the qbusmqtt service:

`sudo systemctl enable qbusmqtt.service`
  
Finally start the service:

`sudo systemctl start qbusmqtt.service`

## openHAB
A new JAR to communicate with MQTT is included in this repository.
To use it, firs disable the current Binding in openHAB if you enabled it from the Binding included in the openHAB Bindings.
Then copy the JAR to openHAB:

```
sudo rm /usr/share/openhab/addons/org.openhab.binding.qbus* 
sudo cp qbusMtt/openHAB/org.openhab.binding.qbus-3.2.0-SNAPSHOT.jar /usr/share/openhab/addons/ 
sudo chown openhab:openhab  /usr/share/openhab/addons/org.openhab.binding.qbus-3.2.0-SNAPSHOT.jar
```
  
Then clean the cache and restart openHAB:
  
```
sudo systemctl stop openhab.service
sudo openhab-cli clean-cache
sudo systemctl start openhab.service 
```
  
The new Qbus Bridge depens on the MQTT Binding, so first install the MQTT Binding before you can use the Qbus Binding.
  
The only thing you've got to chage if you used the previous version is the Bridge:
  
```
Bridge qbus:bridge2:CTDxxxxxx [ ip="<ip mosquitto>", sn="<ctd/sn>", login="<mqttuser>", passwd="<mqttpassw>", port=<mqtt port>] {
}  
```
 
