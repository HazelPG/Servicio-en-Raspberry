var express = require('express');
var app = express();
var server = require('http').Server(app);
var SSE = require('express-sse');
var sse = new SSE(["array", "containing", "initial", "content", "(optional)"]);
var dns = require('dns');
var firebase = require("firebase");
var redis = require('redis');
var async = require('async');
var clientredis = redis.createClient({
    port      : 6379,               // replace with your port
    host      : '127.0.0.1',        // replace with your hostanme or IP address
    // use `fs.readFile[Sync]` or another method to bring these values in
  });

clientredis .on('connect', function(){
	console.log("conectado a redis")
})

clientredis .on('error',function(err){
	console.log("error " + err)
})

var portServer = 8080

var config = {
    apiKey: "AIzaSyBwVQLaJvD3eiVmhzEdhMUCRPGtzJ2oUbA",
    authDomain: "voyagersecbi.firebaseapp.com",
    databaseURL: "https://voyagersecbi.firebaseio.com",
    projectId: "voyagersecbi",
    storageBucket: "voyagersecbi.appspot.com",
    messagingSenderId: "145313582863"
  };

firebase.initializeApp(config);

const SerialPort = require("serialport");
const Readline = require('@serialport/parser-readline')
const PORT = new SerialPort('/dev/ttyACM0'); // PATH del puerto serial


const Parser = PORT.pipe(new Readline({ delimiter: '\r\n' }))

// Add headers
app.use(function (req, res, next) {

    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);

    // Pass to next layer of middleware
    next();
});

app.get('/events', sse.init);


function Getkey(){
	var KeyM = null;
	var Misiones = firebase.database().ref('Misiones/');
		Misiones.orderByChild("Estado").equalTo("Activa").on('value',function(snapshot) {
			var data  = snapshot.val()
			if(data==null){
				KeyM = null;
			}else{
				for(key in data){
					if (data[key].Estado == "Activa" ) {
						KeyM = key;
						break;
					}else{
						KeyM = null;
					}
				}
			}
		});

	return KeyM
}



function onDataCallback (serialLine,res){
	// console.log(serialLine.toString())
	
	dns.lookupService('8.8.8.8', 53, function(err, hostname, service){
		if(err){
		  	// convierte el serialLine en un objeto JSON
		  	console.log("No hay conexion a internet, guardando los datos en localmente...")
			// var data = JSON.parse(serialLine.toString());
			var date =  new Date();
  			var key =  date.getFullYear() +"/"+ (date.getMonth() + 1) + "/" + date.getDate() + "/"+date.getHours() + "/" + date.getMinutes() + "/"+ date.getSeconds();
			clientredis.set(key, serialLine.toString(), redis.print);
			// console.log(serialLine.toString());
			// sse.send(data, 'pushData');
		}else{
			 var KeyMision = null;
			 KeyMision = Getkey();

			clientredis.keys('*', function (err, keys) {
				if (err) return console.log(err);
				// console.log(keys.length)
				if(keys.length == 0){
					if (KeyMision == null ) {
						console.log("No hay Mision Activas")
					}else{
						console.log("si hay misiones activas")
						var data = JSON.parse(serialLine.toString());
						firebase.database().ref('Misiones/'+ KeyMision +'/Sensores/').push(data).then(function(){
							// console.log()
				        })
				 	}
				}else{
					
					if (KeyMision == null ) {
						console.log("Hay Registros En Redis Pero No Hay Misiones Activas, Active una Mision Para guardar Los Datos Obtenidos")
					}else{
						console.log("conexion lograda guardando datos en firebase...")
						async.map(keys, function(key, cb) {
			               clientredis.get(key, function (error, results) {
			               		if (error) return console.log(error);
				           		var data = JSON.parse(results)
				           		console.log(data);
				            	firebase.database().ref('Misiones/'+ KeyMision +'/Sensores/').push(data).then(function(){
									clientredis.del(key, function(err, response) {
								   		if (response == 1) {
								      		console.log("Registro Guardado en la base de firebase y borrado de la base de datos local...")
								   		} else{
								    		console.log("Registro no se pudo borrar")
								   		}
									})
						    	})
		            		});
		           		})
				 	}					
		        }
			}); 
		}	    
	});
}

Parser.on('data', onDataCallback)

server.listen(portServer, function() {
console.log('Servidor corriendo en http://localhost:'+portServer);
});

