var express = require('express')
var app = express()
var server = require('http').Server(app)
var io = require('socket.io')(server)
var request = require('request')
var transitDestinations = require('./public/transitDestinations')
var fs = require('fs')
var JSONStream = require('JSONStream')
var es = require('event-stream')


// used to reduce NYC Pluto data into a smaller file by only saving important stuff
var convertPluto = function (inputURL, district) {
	var sampleFC = {
		type: 'FeatureCollection',
		features: []
	}
	fs.createReadStream(inputURL)
	.pipe(JSONStream.parse('features.*'))
	.on('data', function(element) {
		var featureObj = {
			type: 'Feature',
			geometry: element['geometry'],
			properties: {
				sqftVal: element['properties']['assesstot']/element['properties']['bldgarea'],
				// borough: element['properties']['borough'],
				cd: element['properties']['cd'],
				// address: element['properties']['address'],
				// zipcode: element['properties']['zipcode'],
				// landuse: element['properties']['landuse'],
				// ownertype: element['properties']['ownertype'],
				// bldgclass: element['properties']['bldgclass'],
				// policeprct: element['properties']['policeprct'],
				// schooldist: element['properties']['schooldist'],
				assesstot: element['properties']['assesstot'],
				assessland: element['properties']['assessland'],
				yearbuilt: element['properties']['yearbuilt'],
				yearalter1: element['properties']['yearalter1'],
				yearalter2: element['properties']['yearalter2'],
				// numbldgs: element['properties']['numbldgs'],
				numfloors: element['properties']['numfloors'],
				height: element['properties']['numfloors'] * 3,
				unitstotal: element['properties']['unitstotal'],
				unitsres: element['properties']['unitsres'],
				lotarea: element['properties']['lotarea'],
				bldgarea: element['properties']['bldgarea'],
				comarea: element['properties']['comarea'],
				resarea: element['properties']['resarea'],
				officearea: element['properties']['officearea'],
				retailarea: element['properties']['retailarea'],
				garagearea: element['properties']['garagearea'],
				strgearea: element['properties']['strgearea'],
				factryarea: element['properties']['factryarea'],
				otherarea: element['properties']['otherarea']
			}
		}
		if (element['properties']['cd'] == district) {
			sampleFC.features.push(featureObj)
		}
	})
	.on('end', function() {
		fs.appendFile('pluto' + district + '.geojson', JSON.stringify(sampleFC))
		console.log('done')
	})
}

// use this to loop through all districts in a bourough

// for (var i = 501; i < 504; i++) {
// 	convertPluto('./public/ogPlutoData/simappluto.geojson', i)
// 	console.log(i)
// }


// Router

app.use(express.static('public'))
server.listen(8081)

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/home.html')
});

app.get('/admin', function (req, res) {
  res.sendFile(__dirname + '/admin.html')
});

app.get('/blog', function (req, res) {
	res.sendFile(__dirname + '/blog.html')
});

app.get('/data', function (req, res) {
	res.sendFile(__dirname + '/data.html')
});

app.get('/maps', function (req, res) {
	res.sendFile(__dirname + '/mapMenu.html')
});

app.get('/maps/:district/:data', function (req, res) {
	res.sendFile(__dirname + '/maps.html')
});



//	calculates average travel time to a group of locations in transitDestinations.js

var googleApiKey = 'AIzaSyBAp19Y8cPv8TNzNfJ8OiUxaMHEGL_ELPY'

var destinationsString = ''
var dFeatures = transitDestinations.transitDestinations.features
for (var i = 0; i < dFeatures.length; i++) {
	if (i < dFeatures.length - 1) {
		destinationsString = destinationsString + dFeatures[i].geometry.coordinates[1] + ',' + dFeatures[i].geometry.coordinates[0] + '|'
	} else {
		destinationsString = destinationsString + dFeatures[i].geometry.coordinates[1] + ',' + dFeatures[i].geometry.coordinates[0]
	}
}

io.on('connection', function (socket) {
  socket.on('searchAddress', function (data) {

    var origins = data.address
    request('https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial&mode=transit&origins=' + origins + '&destinations=' + destinationsString + '&key=AIzaSyBAp19Y8cPv8TNzNfJ8OiUxaMHEGL_ELPY', function (error, response, body) {
	  if (!error && response.statusCode == 200) {
	    var responseObj = JSON.parse(body)
	    var distancesArray = []
	    var totalDuration = 0
	    for (var i = 0; i < responseObj.destination_addresses.length; i++) {
	    	var parseDuration = responseObj.rows[0].elements[i].duration.text
	    	var parseDurationArray = parseDuration.split(' ')
	    	var durationMinutes
	    	if (parseDurationArray.length == 2) {
	    		durationMinutes = parseInt(parseDurationArray[0])
	    	} else if (parseDurationArray.length == 4) {
	    		durationMinutes = parseInt(parseDurationArray[0]) * 60 + parseInt(parseDurationArray[2])
	    	} else if (parseDurationArray.length == 6) {
	    		durationMinutes = parseInt(parseDurationArray[0]) * 1440 + parseInt(parseDurationArray[2]) * 60 + parseInt(parseDurationArray[4])
	    	}
	    	var distanceObj = {
	    		origin: responseObj.origin_addresses[0],
	    		destination: responseObj.destination_addresses[i],
	    		destinationName: transitDestinations.transitDestinations.features[i].properties.name,
	    		mode: 'transit',
	    		duration: durationMinutes
	    	}
	    	totalDuration = totalDuration + durationMinutes
	    	distancesArray.push(distanceObj)
	    }

	    console.log(distancesArray, totalDuration/dFeatures.length)
	  }
	})
  });
});