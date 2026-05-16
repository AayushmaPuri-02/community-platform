/**
 * alertLocationPicker.js
 * Simple Google Maps alert location picker.
 * Uses only: google.maps.Map, google.maps.Marker, google.maps.Geocoder
 * No Places API.
 *
 * Call: initAlertLocationPicker(existingLat, existingLng)
 */

(function () {
    'use strict';

    var alertGmap = null;
    var alertGmarker = null;
    var lastReadableName = '';

    // ── Helpers ──────────────────────────────────────────────────────────────

    function setFields(lat, lng, name) {
        document.getElementById('latitudeInput').value = lat;
        document.getElementById('longitudeInput').value = lng;
        document.getElementById('locationNameInput').value = name;
        document.getElementById('alertLocationInput').value = name;
        document.getElementById('alertLocationError').style.display = 'none';
        if (name && name.indexOf(',') === -1 ? name.length > 3 : true) {
            lastReadableName = name;
        }
    }

    function showLabel(text, isError) {
        var label = document.getElementById('alertLocationLabel');
        label.textContent = text;
        label.style.color = isError ? '#dc3545' : '#198754';
        label.style.display = 'block';
    }

    function reverseGeocode(latLng, onDone) {
        var geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: latLng }, function (results, status) {
            if (status === 'OK' && results && results.length > 0) {
                onDone(bestAddress(results));
            } else {
                onDone(null);
            }
        });
    }

    // Return the first result whose formatted_address does NOT start with a Plus Code.
    // Falls back to the first result if all start with Plus Codes.
    function bestAddress(results) {
        var plusCodeRe = /^[A-Z0-9]{4,}\+[A-Z0-9]{2,}/;
        for (var i = 0; i < results.length; i++) {
            if (!plusCodeRe.test(results[i].formatted_address)) {
                return results[i].formatted_address;
            }
        }
        return results[0].formatted_address;
    }

    function moveMarker(latLng) {
        alertGmarker.setPosition(latLng);
        alertGmarker.setVisible(true);
    }

    // ── Main init ─────────────────────────────────────────────────────────────

    window.initAlertLocationPicker = function (existingLat, existingLng) {
        if (alertGmap) return; // prevent double-init

        var mapDiv = document.getElementById('alertGoogleMap');
        if (!mapDiv) return;
        mapDiv.style.display = 'block';

        var hasExisting = !!(existingLat && existingLng &&
            !isNaN(existingLat) && !isNaN(existingLng) &&
            existingLat !== 0 && existingLng !== 0);

        var center = hasExisting
            ? { lat: existingLat, lng: existingLng }
            : { lat: 27.7172, lng: 85.3240 };

        alertGmap = new google.maps.Map(mapDiv, {
            center: center,
            zoom: hasExisting ? 16 : 13,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
        });

        // Create marker — visible only if editing with existing coords
        alertGmarker = new google.maps.Marker({
            map: alertGmap,
            draggable: true,
            position: hasExisting ? center : null,
            visible: Boolean(hasExisting),
        });

        // Pre-fill lastReadableName from visible input when editing
        var existingInputVal = (document.getElementById('alertLocationInput').value || '').trim();
        if (existingInputVal) {
            lastReadableName = existingInputVal;
        }

        // ── Search button (Geocoder only, no Places API) ────────────────────────
        var searchBtn = document.getElementById('alertSearchBtn');
        var input = document.getElementById('alertLocationInput');

        if (searchBtn && input) {
            searchBtn.addEventListener('click', function () {
                var query = input.value.trim();
                if (!query) return;

                var searchQuery = /nepal/i.test(query) ? query : query + ', Kathmandu, Nepal';

                searchBtn.disabled = true;
                searchBtn.textContent = 'Searching\u2026';

                var kathmanduBounds = new google.maps.LatLngBounds(
                    new google.maps.LatLng(27.60, 85.20),
                    new google.maps.LatLng(27.85, 85.45)
                );

                var geocoder = new google.maps.Geocoder();
                geocoder.geocode(
                    { address: searchQuery, bounds: kathmanduBounds },
                    function (results, status) {
                        searchBtn.disabled = false;
                        searchBtn.textContent = 'Search';

                        if (status === 'OK' && results[0]) {
                            var loc = results[0].geometry.location;
                            var name = bestAddress(results);
                            alertGmap.setCenter(loc);
                            alertGmap.setZoom(16);
                            moveMarker(loc);
                            setFields(loc.lat(), loc.lng(), name);
                            showLabel('Pinned: ' + name, false);
                        } else {
                            showLabel('No location found. Try a more specific place name.', true);
                        }
                    }
                );
            });
        }

        // ── Map click ───────────────────────────────────────────────────────────
        alertGmap.addListener('click', function (e) {
            var lat = e.latLng.lat();
            var lng = e.latLng.lng();

            moveMarker(e.latLng);

            // Update coords immediately with fallback name
            var fallback = lastReadableName || (lat.toFixed(5) + ', ' + lng.toFixed(5));
            document.getElementById('latitudeInput').value = lat;
            document.getElementById('longitudeInput').value = lng;
            document.getElementById('locationNameInput').value = fallback;
            document.getElementById('alertLocationError').style.display = 'none';
            showLabel('Pinned: ' + lat.toFixed(5) + ', ' + lng.toFixed(5), false);

            reverseGeocode(e.latLng, function (address) {
                if (address) {
                    setFields(lat, lng, address);
                    showLabel('Pinned: ' + address, false);
                }
                // If reverse geocode fails, coords are already saved; visible input keeps last readable name
            });
        });

        // ── Marker drag ─────────────────────────────────────────────────────────
        alertGmarker.addListener('dragend', function () {
            var pos = alertGmarker.getPosition();
            var lat = pos.lat();
            var lng = pos.lng();

            var fallback = lastReadableName || (lat.toFixed(5) + ', ' + lng.toFixed(5));
            document.getElementById('latitudeInput').value = lat;
            document.getElementById('longitudeInput').value = lng;
            document.getElementById('locationNameInput').value = fallback;
            document.getElementById('alertLocationError').style.display = 'none';
            showLabel('Pinned: ' + lat.toFixed(5) + ', ' + lng.toFixed(5), false);

            reverseGeocode(pos, function (address) {
                if (address) {
                    setFields(lat, lng, address);
                    showLabel('Pinned: ' + address, false);
                }
            });
        });
    };

})();
