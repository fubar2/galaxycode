import $ from "jquery";
import _ from "underscore";

import { Map, View, Graticule } from "ol";
import { OSM, Vector } from "ol/source";
import { GeoJSON } from "ol/format";
import * as interaction from "ol/interaction";
import * as style from "ol/style";
import * as layer from "ol/layer";
import * as control from "ol/control";
import { saveAs } from "file-saver";

import proj4 from "proj4";
import JSZipUtils from "jszip-utils";
import JSZip from "jszip";

const geojsonData = {};

const SHP = {
    NULL: 0,
    POINT: 1,
    POLYLINE: 3,
    POLYGON: 5
};

SHP.getShapeName = function(id) {
    for (const name in this) {
        if (id === this[name]) {
            return name;
        }
    }
};

const SHPParser = function() {};

SHPParser.prototype.parseShape = function(dv, idx, length) {
    let i = 0;
    let c = null;
    const shape = {};

    shape.type = dv.getInt32(idx, true);
    idx += 4;
    switch (shape.type) {
        case SHP.NULL: // Null
            break;

        case SHP.POINT: // Point (x,y)
            shape.content = {
                x: dv.getFloat64(idx, true),
                y: dv.getFloat64(idx + 8, true)
            };
            break;
        case SHP.POLYLINE: // Polyline (MBR, partCount, pointCount, parts, points)
        case SHP.POLYGON: // Polygon (MBR, partCount, pointCount, parts, points)
            c = shape.content = {
                minX: dv.getFloat64(idx, true),
                minY: dv.getFloat64(idx + 8, true),
                maxX: dv.getFloat64(idx + 16, true),
                maxY: dv.getFloat64(idx + 24, true),
                parts: new Int32Array(dv.getInt32(idx + 32, true)),
                points: new Float64Array(dv.getInt32(idx + 36, true) * 2)
            };
            idx += 40;
            for (i = 0; i < c.parts.length; i++) {
                c.parts[i] = dv.getInt32(idx, true);
                idx += 4;
            }
            for (i = 0; i < c.points.length; i++) {
                c.points[i] = dv.getFloat64(idx, true);
                idx += 8;
            }
            break;
    }
    return shape;
};

SHPParser.prototype.parse = function(arrayBuffer, url) {
    const o = {};
    const dv = new DataView(arrayBuffer);
    let idx = 0;

    o.fileName = url;
    o.fileCode = dv.getInt32(idx, false);

    idx += 6 * 4;
    o.wordLength = dv.getInt32(idx, false);
    o.byteLength = o.wordLength * 2;
    idx += 4;
    o.version = dv.getInt32(idx, true);
    idx += 4;
    o.shapeType = dv.getInt32(idx, true);
    idx += 4;
    o.minX = dv.getFloat64(idx, true);
    o.minY = dv.getFloat64(idx + 8, true);
    o.maxX = dv.getFloat64(idx + 16, true);
    o.maxY = dv.getFloat64(idx + 24, true);
    o.minZ = dv.getFloat64(idx + 32, true);
    o.maxZ = dv.getFloat64(idx + 40, true);
    o.minM = dv.getFloat64(idx + 48, true);
    o.maxM = dv.getFloat64(idx + 56, true);
    idx += 8 * 8;
    o.records = [];
    while (idx < o.byteLength) {
        const record = {};
        record.number = dv.getInt32(idx, false);
        idx += 4;
        record.length = dv.getInt32(idx, false);
        idx += 4;
        try {
            record.shape = this.parseShape(dv, idx, record.length);
        } catch (e) {
            break;
        }
        idx += record.length * 2;
        o.records.push(record);
    }
    return o;
};

SHPParser.load = function(url, callback, returnData) {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.responseType = "arraybuffer";
    xhr.onload = function() {
        geojsonData.shp = new SHPParser().parse(xhr.response, url);
        callback(geojsonData.shp, returnData);
        URL.revokeObjectURL(url);
    };
    // TODO: This does not exist?
    //xhr.onerror = onerror;
    xhr.onerror = callback;
    xhr.send(null);
};

const DBFParser = function() {};

DBFParser.load = function(url, encoding, callback, returnData) {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.responseType = "arraybuffer";
    xhr.onload = function() {
        const xhrText = new XMLHttpRequest();
        xhrText.open("GET", url);
        xhrText.overrideMimeType("text/plain; charset=" + encoding);
        xhrText.onload = function() {
            geojsonData.dbf = new DBFParser().parse(xhr.response, url, xhrText.responseText, encoding);
            callback(geojsonData.dbf, returnData);
            URL.revokeObjectURL(url);
        };
        xhrText.send();
    };
    // TODO: This does not exist?
    //xhr.onerror = onerror;
    xhr.onerror = callback;
    xhr.send(null);
};

DBFParser.prototype.parse = function(arrayBuffer, src, response, encoding) {
    const o = {};
    const dv = new DataView(arrayBuffer);
    let idx = 0;
    let offset;

    switch (encoding.toLowerCase()) {
        case "big5":
            offset = 2;
            break;
        case "iso-8859-1":
            offset = 1;
            break;
        default:
            offset = 3;
    }

    o.fileName = src;
    o.version = dv.getInt8(idx, false);

    idx += 1;
    o.year = dv.getUint8(idx) + 1900;
    idx += 1;
    o.month = dv.getUint8(idx);
    idx += 1;
    o.day = dv.getUint8(idx);
    idx += 1;

    o.numberOfRecords = dv.getInt32(idx, true);
    idx += 4;
    o.bytesInHeader = dv.getInt16(idx, true);
    idx += 2;
    o.bytesInRecord = dv.getInt16(idx, true);
    idx += 2;
    //reserved bytes
    idx += 2;
    o.incompleteTransation = dv.getUint8(idx);
    idx += 1;
    o.encryptionFlag = dv.getUint8(idx);
    idx += 1;
    // skip free record thread for LAN only
    idx += 4;
    // reserved for multi-user dBASE in dBASE III+
    idx += 8;
    o.mdxFlag = dv.getUint8(idx);
    idx += 1;
    o.languageDriverId = dv.getUint8(idx);
    idx += 1;
    // reserved bytes
    idx += 2;

    o.fields = [];
    let responseHeader;
    const response_handler = response.split("\r");
    if (response_handler.length > 2) {
        response_handler.pop();
        responseHeader = response_handler.join("\r");
        responseHeader = responseHeader.slice(32, responseHeader.length);
    } else {
        responseHeader = response_handler[0];
        responseHeader = responseHeader.slice(32, responseHeader.length);
        offset = 2;
    }

    const charString = [];
    let count = 0;
    let index = 0;

    while (responseHeader.length > 0) {
        while (count < 10) {
            try {
                if (encodeURIComponent(responseHeader[z]).match(/%[A-F\d]{2}/g)) {
                    if (encodeURIComponent(responseHeader[z]).match(/%[A-F\d]{2}/g).length > 1) {
                        count += offset;
                        z++;
                    } else {
                        count += 1;
                        z++;
                    }
                } else {
                    count += 1;
                    z++;
                }
            } catch (error) {
                // avoid malformed URI
                count += 1;
                z++;
            }
        }

        charString.push(responseHeader.slice(0, 10).replace(/\0/g, ""));
        responseHeader = responseHeader.slice(32, responseHeader.length);
    }

    for (;;) {
        const field = {},
            nameArray = [];

        for (var i = 0, z = 0; i < 10; i++) {
            try {
                const letter = dv.getUint8(idx);
                if (letter != 0) nameArray.push(String.fromCharCode(letter));
                idx += 1;
            } catch (error) {
                break;
            }
        }
        try {
            field.name = charString[index++];
            idx += 1;
            field.type = String.fromCharCode(dv.getUint8(idx));
            idx += 1;
            // Skip field data address
            idx += 4;
            field.fieldLength = dv.getUint8(idx);
            idx += 1;
            //field.decimalCount = dv.getUint8(idx);
            idx += 1;
            // Skip reserved bytes multi-user dBASE.
            idx += 2;
            field.workAreaId = dv.getUint8(idx);
            idx += 1;
            // Skip reserved bytes multi-user dBASE.
            idx += 2;
            field.setFieldFlag = dv.getUint8(idx);
            idx += 1;
            // Skip reserved bytes.
            idx += 7;
            field.indexFieldFlag = dv.getUint8(idx);
            idx += 1;
            o.fields.push(field);
        } catch (error) {
            break;
        }
    }


    let responseText;
    idx += 1;
    o.fieldpos = idx;
    o.records = [];

    responseText = response.split("\r")[response.split("\r").length - 1];

    for (let i = 0; i < o.numberOfRecords; i++) {
        responseText = responseText.slice(1, responseText.length);
        const record = {};


        for (let j = 0; j < o.fields.length; j++) {
            // TODO Problem: charString is redefined below before ever being used?
            const charString = [];
            let count = 0;
            let z = 0;

            while (count < o.fields[j].fieldLength) {
                try {
                    if (encodeURIComponent(responseText[z]).match(/%[A-F\d]{2}/g)) {
                        if (encodeURIComponent(responseText[z]).match(/%[A-F\d]{2}/g).length > 1) {
                            count += offset;
                            z++;
                            // Check is not defined and unused?
                            // check = 1;
                        } else {
                            count += 1;
                            z++;
                        }
                    } else {
                        count += 1;
                        z++;
                    }
                } catch (error) {
                    // avoid malformed URI
                    count += 1;
                    z++;
                }
            }

            charString.push(responseText.slice(0, z).replace(/\0/g, ""));
            responseText = responseText.slice(z, responseText.length);

            if (
                charString
                    .join("")
                    .trim()
                    .match(/\d{1}\.\d{11}e\+\d{3}/g)
            ) {
                record[o.fields[j].name] = parseFloat(charString.join("").trim());
            } else {
                record[o.fields[j].name] = charString.join("").trim();
            }
        }
        o.records.push(record);
    }
    return o;
};

const inputData = {};
const EPSG4326 = proj4("EPSG:4326");

function loadshp(config, returnData) {
    const url = config.url;
    const encoding = config.encoding != "utf-8" ? config.encoding : "utf-8";
    proj4.defs([
        ["EPSG:4326", "+title=WGS 84 (long/lat) +proj=longlat +ellps=WGS84 +datum=WGS84 +units=degrees"],
        [
            "EPSG:4269",
            "+title=NAD83 (long/lat) +proj=longlat +a=6378137.0 +b=6356752.31414036 +ellps=GRS80 +datum=NAD83 +units=degrees"
        ]
    ]);

    if (typeof url === "string") {
        JSZipUtils.getBinaryContent(url, function(err, data) {
            const URL = window.URL || window.webkitURL || window.mozURL || window.msURL;
            const zip = new JSZip();
            let shpString, dbfString;
            zip.loadAsync(data).then(function(zipFiles) {
                shpString = zipFiles.file(/.shp$/i)[0].name;
                dbfString = zipFiles.file(/.dbf$/i)[0].name;

                zipFiles
                    .file(shpString)
                    .async("arraybuffer")
                    .then(function(content) {
                        SHPParser.load(URL.createObjectURL(new Blob([content])), shpLoader, returnData);
                    });

                zipFiles
                    .file(dbfString)
                    .async("arraybuffer")
                    .then(function(content) {
                        DBFParser.load(URL.createObjectURL(new Blob([content])), encoding, dbfLoader, returnData);
                    });
            });
        });
    }
}
/*
function loadEPSG(url, callback) {
    var script = document.createElement("script");
    script.src = url;
    script.onreadystatechange = callback;
    script.onload = callback;
    document.getElementsByTagName("head")[0].appendChild(script);
}
*/

function TransCoord(x, y) {
    const p = proj4(EPSG4326, [parseFloat(x), parseFloat(y)]);
    return { x: p[0], y: p[1] };
}

function shpLoader(data, returnData) {
    inputData.shp = data;
    if (inputData.shp && inputData.dbf) if (returnData) returnData(toGeojson(inputData));
}

function dbfLoader(data, returnData) {
    inputData.dbf = data;
    if (inputData.shp && inputData.dbf) if (returnData) returnData(toGeojson(inputData));
}

function toGeojson(geojsonData) {
    const geojson = {};
    const features = [];
    let feature;
    let geometry;

    const shpRecords = geojsonData.shp.records;
    //var dbfRecords = geojsonData.dbf.records;

    geojson.type = "FeatureCollection";
    const min_coordinate = TransCoord(geojsonData.shp.minX, geojsonData.shp.minY);
    const max_coordinate = TransCoord(geojsonData.shp.maxX, geojsonData.shp.maxY);
    geojson.bbox = [min_coordinate.x, min_coordinate.y, max_coordinate.x, max_coordinate.y];

    geojson.features = features;

    for (let i = 0; i < shpRecords.length; i++) {
        feature = {};
        feature.type = "Feature";
        geometry = feature.geometry = {};
        //const properties = (feature.properties = dbfRecords[i]);
        // point : 1 , polyline : 3 , polygon : 5, multipoint : 8
        let reprj;
        switch (shpRecords[i].shape.type) {
            case 1:
                geometry.type = "Point";
                reprj = TransCoord(shpRecords[i].shape.content.x, shpRecords[i].shape.content.y);
                geometry.coordinates = [reprj.x, reprj.y];
                break;
            case 3:
            case 8:
                geometry.type = shpRecords[i].shape.type == 3 ? "LineString" : "MultiPoint";
                geometry.coordinates = [];
                for (let j = 0; j < shpRecords[i].shape.content.points.length; j += 2) {
                    reprj = TransCoord(
                        shpRecords[i].shape.content.points[j],
                        shpRecords[i].shape.content.points[j + 1]
                    );
                    geometry.coordinates.push([reprj.x, reprj.y]);
                }
                break;
            case 5:
                geometry.type = "Polygon";
                geometry.coordinates = [];

                for (let pts = 0; pts < shpRecords[i].shape.content.parts.length; pts++) {
                    const partsIndex = shpRecords[i].shape.content.parts[pts];
                    const part = [];

                    for (
                        let j = partsIndex * 2;
                        j <
                        (shpRecords[i].shape.content.parts[pts + 1] * 2 || shpRecords[i].shape.content.points.length);
                        j += 2
                    ) {
                        const point = shpRecords[i].shape.content.points;
                        reprj = TransCoord(point[j], point[j + 1]);
                        part.push([reprj.x, reprj.y]);
                    }
                    geometry.coordinates.push(part);
                }
                break;
            default:
        }
        if ("coordinates" in feature.geometry) {
            features.push(feature);
        }
    }
    return geojson;
}

const MapViewer = (function(mv) {
    mv.gMap = null;

    /** Set the style properties of shapes */
    mv.setStyle = selectedColor => {
        const styles = {
            Polygon: new style.Style({
                stroke: new style.Stroke({
                    color: selectedColor,
                    width: 1
                }),
                fill: new style.Fill({
                    color: "rgba(0, 0, 255, 0.1)"
                })
            }),
            Circle: new style.Style({
                stroke: new style.Stroke({
                    color: selectedColor,
                    width: 1
                }),
                fill: new style.Fill({
                    color: "rgba(0, 0, 255, 0.1)"
                })
            }),
            Point: new style.Style({
                image: new style.Circle({
                    radius: 5,
                    fill: new style.Fill({
                        color: "rgba(0, 0, 255, 0.1)"
                    }),
                    stroke: new style.Stroke({ color: selectedColor, width: 1 })
                })
            }),
            LineString: new style.Style({
                stroke: new style.Stroke({
                    color: selectedColor,
                    width: 1
                })
            }),
            MultiLineString: new style.Style({
                stroke: new style.Stroke({
                    color: selectedColor,
                    width: 1
                })
            }),
            MultiPoint: new style.Style({
                image: new style.Circle({
                    radius: 5,
                    fill: new style.Fill({
                        color: "rgba(0, 0, 255, 0.1)"
                    }),
                    stroke: new style.Stroke({ color: selectedColor, width: 1 })
                })
            }),
            MultiPolygon: new style.Style({
                stroke: new style.Stroke({
                    color: selectedColor,
                    width: 1
                }),
                fill: new style.Fill({
                    color: "rgba(0, 0, 255, 0.1)"
                })
            }),
            GeometryCollection: new style.Style({
                stroke: new style.Stroke({
                    color: selectedColor,
                    width: 1
                }),
                fill: new style.Fill({
                    color: selectedColor
                }),
                image: new style.Circle({
                    radius: 10,
                    fill: null,
                    stroke: new style.Stroke({
                        color: selectedColor
                    })
                })
            })
        };
        return styles;
    };

    /** Set up events and methods for interactions with map view*/
    mv.setInteractions = (source, options) => {
        const geometryType = options.chart.settings.get("geometry_type");
        const geometryColor = options.chart.settings.get("geometry_color");
        let drawInteraction;

        const addInteraction = () => {
            if (geometryType !== "None") {
                drawInteraction = new interaction.Draw({
                    source: source,
                    type: geometryType,
                    freehand: true
                });
                drawInteraction.on("drawstart", event => {
                    const sty = new style.Style({
                        stroke: new style.Stroke({
                            color: geometryColor,
                            width: 2
                        }),
                        fill: new style.Fill({
                            color: "rgba(0, 0, 255, 0.1)"
                        })
                    });
                    event.feature.setStyle(sty);
                });
                mv.gMap.addInteraction(drawInteraction);
            }
        };
        addInteraction();
    };

    /** Export the map view to PNG image*/
    mv.exportMap = () => {
        mv.gMap.once("rendercomplete", event => {
            const canvas = event.context.canvas;
            let fileName = Math.random()
                .toString(11)
                .replace("0.", "");
            fileName += ".png";
            if (navigator.msSaveBlob) {
                navigator.msSaveBlob(canvas.msToBlob(), fileName);
            } else {
                canvas.toBlob(blob => {
                    saveAs(blob, fileName);
                });
            }
        });
        mv.gMap.renderSync();
    };

    /** Create the map view */
    mv.setMap = (vSource, target, options, styleFunction) => {
        const tile = new layer.Tile({ source: new OSM() });
        // add fullscreen handle
        const fullScreen = new control.FullScreen();
        // add scale to the map
        const scaleLineControl = new control.ScaleLine();
        // create vector with styles
        const vectorLayer = new layer.Vector({
            source: vSource,
            style: styleFunction
        });

        const view = new View({
            center: [0, 0],
            zoom: 2
        });

        // create map view
        mv.gMap = new Map({
            controls: control.defaults().extend([scaleLineControl, fullScreen]),
            interactions: interaction.defaults().extend([new interaction.DragRotateAndZoom()]),
            layers: [tile, vectorLayer],
            target: target,
            loadTilesWhileInteracting: true,
            view: view
        });

        // add grid lines
        const graticule = new Graticule({
            strokeStyle: new style.Stroke({
                color: "rgba(255, 120, 0, 0.9)",
                width: 2,
                lineDash: [0.5, 4]
            }),
            showLabels: true
        });

        mv.gMap.addInteraction(new interaction.Modify({ source: vSource }));
        mv.gMap.addControl(new control.ZoomSlider());
        graticule.setMap(mv.gMap);
        mv.setInteractions(vSource, options);
    };

    /** Load the map GeoJson and Shapefiles*/
    mv.loadFile = (filePath, fileType, options, chart) => {
        const target = options.targets[0];
        const formatType = new GeoJSON();
        const toExport = options.chart.settings.get("export_map");
        const geometryColor = options.chart.settings.get("geometry_color");
        const selectedStyles = mv.setStyle(geometryColor);
        const styleFunction = feature => {
            return selectedStyles[feature.getGeometry().getType()];
        };

        if (toExport === "export") {
            mv.exportMap();
        }

        if (fileType === "geojson") {
            const sourceVec = new Vector({ format: formatType, url: filePath, wrapX: false });
            mv.createMap(filePath, sourceVec, options, chart, styleFunction, target);
        } else if (fileType === "shp") {
            loadshp({ url: filePath, encoding: "utf-8", EPSG: 4326 }, geoJson => {
                const url = window.URL.createObjectURL(new Blob([JSON.stringify(geoJson)], { type: "application/json" }));
                const sourceVec = new Vector({ format: formatType, url: url, wrapX: false });
                mv.createMap(url, sourceVec, options, chart, styleFunction, target);
            });
        }
    };

    mv.createMap = (filePath, sourceVec, options, chart, styleFunction, target) => {
        mv.setMap(sourceVec, target, options, styleFunction);
        chart.state("ok", "Chart drawn.");
        options.process.resolve();
    };

    return mv;
})(MapViewer || {});

_.extend(window.bundleEntries || {}, {
    load: options => {
        const chart = options.chart;
        const dataset = options.dataset;
        $.ajax({
            url: dataset.download_url,
            success: content => {
                MapViewer.loadFile(dataset.download_url, dataset.extension, options, chart);
            },
            error: () => {
                chart.state("failed", "Failed to access dataset.");
                options.process.resolve();
            }
        });
    }
});
