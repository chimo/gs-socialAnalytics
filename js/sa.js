/*global jQuery: false, OpenLayers: false, Chartist: false*/
(function($, window, OpenLayers, Chartist) {
    "use strict";

    $("#wrap").addClass("sa-js");

    var buildCustomDate,
        buildDatePicker,
        buildMap,
        buildGraphs,
        buildLineGraphLegend,
//        buildPieGraphLegend,
        buildLineGraphs,
        buildPieCharts,
        enhanceTables,
        nativeDatePicker,
        sum,
        SA = window.SA,
        snRoot = window.location.pathname.replace(/(\/index\.php)?\/social$/, "/");

    /**
     * Build OpenStreetMap map
     */
    buildMap = function() {

        // We don't have any map data; bail.
        if (!SA) {
            return;
        }

        var map = new OpenLayers.Map("sa-map"),
            bounds = new OpenLayers.Bounds(),
            lyrMarkers = new OpenLayers.Layer.Markers("Markers"),
            currentPopup = null,
            followingCoords = SA.followingCoords,
            followersCoords = SA.followersCoords,
            addMarker,
            addMarkers,
            newPopup,
            markerClick;

        /**
         * Creates a popup that will show up when clicking on the marker
         */
        newPopup = function(lonLat, content) {
            var popup = new OpenLayers.Feature(lyrMarkers, lonLat),
                popupClass = OpenLayers.Class(OpenLayers.Popup.FramedCloud, {
                    "autoSize": true,
                    "minSize": new OpenLayers.Size(300, 50),
                    "maxSize": new OpenLayers.Size(500, 300),
                    "keepInMap": true
                });

            popup.closeBox = true;
            popup.popupClass = popupClass;
            popup.data.popupContentHTML = $("a.url[href='" + content + "']").first().closest("li").html();
            popup.data.overflow = "auto";

            return popup;
        };

        /**
         * Triggered when clicking on a map marker
         */
        markerClick = function(evt) {
            var osm = this;

            if (currentPopup !== null && currentPopup.visible()) {
                currentPopup.hide();
            }

            if (osm.popup === null) {
                osm.popup = osm.createPopup(osm.closeBox);
                map.addPopup(osm.popup);
                osm.popup.show();
            } else {
                osm.popup.toggle();
            }

            currentPopup = osm.popup;
            OpenLayers.Event.stop(evt);
        };

        /**
         * Adds a marker to the map
         */
        addMarker = function(lon, lat, nickname, icon_filename) {
            var lonLat,
                size,
                icon,
                marker;

            lonLat = new OpenLayers.LonLat(lon, lat)
                .transform(
                    new OpenLayers.Projection("EPSG:4326"), // transform from WGS 1984
                    map.getProjectionObject()               // to Spherical Mercator Projection
                );

            bounds.extend(lonLat);

            size = new OpenLayers.Size(21, 25);
            icon = new OpenLayers.Icon("http://www.openlayers.org/dev/img/" + icon_filename,
                                size,
                                new OpenLayers.Pixel(-(size.w / 2), -size.h));

            marker = new OpenLayers.Marker(lonLat, icon.clone());
            marker.events.register("mousedown", newPopup(lonLat, nickname), markerClick);
            lyrMarkers.addMarker(marker);
        };

        /**
         * Calls addMarker() for each item in array
         */
        addMarkers = function(arr, icon) {
            var i,
                len;

            for (i = 0, len = arr.length; i < len; i += 1) {
                addMarker(arr[i].lon, arr[i].lat, arr[i].nickname, icon);
            }
        };

        map.addLayer(new OpenLayers.Layer.OSM());
        map.addLayer(lyrMarkers);

        // Add markers for people we started to follow
        if (followingCoords) {
            addMarkers(followingCoords, "marker.png");
        }

        // Add markers for people who started to follow us
        if (followersCoords) {
            addMarkers(followersCoords, "marker-blue.png");
        }

        map.setCenter(bounds.getCenterLonLat(), map.getZoomForExtent(bounds) - 1);
    };

    /**
     * Whether the browser supports HTML5 date picker (type="date")
     *
     * `true` or `false`
     */
    nativeDatePicker = (function() {
        var i = document.createElement("input");
        i.setAttribute("type", "date");
        return i.type !== "text";
    }());

    /**
     * "Custom date range" link
     */
    buildCustomDate = function() {
            // Show/hide custom date form
            $(".sa-cust a").on("click", function(e) {
                e.preventDefault();

                var $link = $(this);

                $link
                    .parent() // TODO: ARIA
                    .find(".sa-picker")
                    .fadeToggle();
            });
    };

    /**
     * Invoke jQueryUI's datepicker if the browser doesn't support type="date"
     * natively
     */
    buildDatePicker = function() {
        if (!nativeDatePicker) {
            $("#sa-date-s-t, #sa-date-e-t, #sa-date-s-b, #sa-date-e-b").datepicker({
                buttonImage: snRoot + "plugins/SocialAnalytics/images/calendar.png",
                buttonImageOnly: true,
                changeMonth: true,
                changeYear: true,
                dateFormat: "yy-mm-dd",
                maxDate: new Date(),
                showOn: "button"
            });
        }
    };

    /**
     * Click event on legend labels
     */
    $(document).on("click", ".sa-legend a", function(e) {
        e.preventDefault();

        var $link = $(this),
            $svg = $link.closest(".ct-chart").find("svg"),
            seriesName = $link.data("name"),
            $line = $svg.find(".ct-series").filter("[ct\\:series-name='" + seriesName + "']");

        $line.get(0).classList.toggle("sa-hide");
    });

    /**
     * Build graph legend
     */
    buildLineGraphLegend = function(data) {
        var $svg = $(data.svg._node),
            $container,
            $series,
            html;

        // Don't build more than one legend
        // Necessary since the "create" event can be triggered more than once
        // TODO: try unbinding the event while in here.
        if ($svg.parent().find(".sa-legend").length > 0) {
            window.console.log($svg.parent());
            return;
        }

        $container = $("<ul class='sa-legend'></ul>").insertBefore($svg);
        $series = $svg.find(".ct-series");
        html = "";

        $series.each(function() {
            var $this = $(this),
                label = $this.attr("ct:series-name"),
                color = $this.find(".ct-line").css("stroke");

            html += "<li><span style='color: " + color + "'>■</span>&nbsp;<a data-name='" + label + "' href='#'>" + label + "</a></li>";
        });

        $container.html(html);
    };

    /**
     * Build line graphs
     */
    buildLineGraphs = function() {
        var $tables = $(".sa-line");

        $tables.each(function() {
            var chart,
                $table = $(this),
                $headers = $table.find("thead th"),
                $contentRows = $table.find("tbody tr"),
                series = [],
                seriesData = [],
                labels = [],
                i,
                len,
                data,
                $graphContainer,
                $tooltip;

            $graphContainer = $("<div class='ct-chart'><div class='tooltip' style='display: none;'></div></div>").insertBefore($table.closest("details"));
            $tooltip = $graphContainer.find(".tooltip");

            // Prepare arrays for the different series
            for (i = 0, len = $headers.length; i < len; i += 1) {
                seriesData.push([]);
            }

            // Gather series data and labels
            $contentRows.each(function() {
                var $row = $(this);

                // Labels: only keep the day (ex: 2014-01-02 becomes 02)
                labels.push($row.children("th").text().split("-")[2]);

                // Data
                $row.children("td").each(function(j) {
                    var $cell = $(this);

                    seriesData[j].push(parseInt($cell.text(), 10));
                });
            });

            // Associate names (columns) with series data (rows)
            for (i = 0, len = seriesData.length; i < len; i += 1) {
                series.push({
                    name: $headers.eq(i).text(),
                    data: seriesData[i]
                });
            }

            // Object required by chartist
            data = {
                "labels": labels,
                "series": series
            };

            // Build graph
            chart = new Chartist.Line($graphContainer.get(0), data);

            // Build the legend after the graph has been created
            chart.on("created", buildLineGraphLegend);

/**
 * TODO: Also show tooltip on focus (for mobile, keyboard)
 */

            $graphContainer
                // Show tooltip when cursor is over point
                .on("mouseenter", ".ct-point", function() {
                    var $point = $(this),
                        value = $point.attr("ct:value"),
                        seriesName = $point.parent().attr("ct:series-name");

                    $tooltip
                        .html(value + "<br>" + seriesName)
                        .show();
                })
                // Hide tooltip when cursor leaves graph
                .on("mouseleave", ".ct-point", function() {
                   $tooltip.hide();
                })
                // Position tooltip in relation to the cursor
                .on("mousemove", function(event) {
                    $tooltip.css({
                        left: (event.offsetX || event.originalEvent.layerX) - $tooltip.width() / 2 - 10,
                        top: (event.offsetY || event.originalEvent.layerY) - $tooltip.height() - 40
                    });
                });
        });
    };

    /**
     * Add two numbers
     */
    sum = function(a, b) {
        return a + b;
    };

    /**
     * Build pie charts
     */
    buildPieCharts = function() {
        var $tables = $(".sa-pie");

        $tables.each(function() {
            var $table = $(this),
                $cells = $table.find("tbody td"),
                series = [],
                $graph,
                data;

            $graph = $("<div class='ct-chart ct-octave'></div>").insertBefore($table.closest("details"));

            $cells.each(function() {
                var $cell = $(this),
                    num = parseInt($cell.text(), 10);

                series.push(num);
            });

            data = {
                "series": series
            };

            new Chartist.Pie($graph.get(0), data, {
                // We want percentages as labels, not absolute numbers
                labelInterpolationFnc: function(value) {
                    return Math.round(value / data.series.reduce(sum) * 100) + "%";
                }
            });
        });
    };

    /**
     * Build the graphs
     */
    buildGraphs = function() {
        buildLineGraphs();
        buildPieCharts();
    };

    /**
     * Add links to the table data
     */
    enhanceTables = function() {
        var callback,
            $dial = $("<div id='sa-dialog'></div>").dialog({
                autoOpen: false,
                modal: true,
                width: 700
            }).css("max-height", $(window).height());

        callback = function(elm) {
            return function(data) {
                var date = new Date(data.created_at), // TODO: handle cases when this fails
                    html = "<div class='entry-title'>" +
                        "<div class='author'>" +
                         "<span class='vcard author'>" +
                          "<a href='" + data.user.statusnet_profile_url + "' class='url' title='" + data.user.screen_name + "'>" +
                           "<img width='48' height='48' src='" + data.user.profile_image_url + "' class='avatar photo' alt='" + data.user.screen_name + "'>" +
                            "<span class='fn'>" + data.user.screen_name + "</span>" +
                          "</a>" +
                         "</span>" +
                        "</div>" +
                        "<p class='entry-content'>" + data.statusnet_html + "</p>" +
                        "</div>" +
                        "<div class='entry-content'>on " +
                        "<a rel='bookmark' class='timestamp' href='" + snRoot + "notice/" + data.id + "'>" +
                         "<abbr class='published' title='" + data.created_at  + "'>" + date.toISOString().split("T")[0] + "</abbr>" +
                        "</a>" +
                         "<span class='source'>from <span class='device'>" +
                          "<a href='" + snRoot + "notice/" + data.id + "' rel='external'>" + data.source + "</a>" +
                         "</span>" +
                        "</span>";

                // If it's a repeat or a reply, show in context link
                if (typeof data.retweeted_status !== "undefined" || data.in_reply_to_user_id !== null) {
                    html += "<a class='response' href='" + snRoot + "conversation/" +
                        data.statusnet_conversation_id + "#notice-" + data.id + "'>in context</a>";
                }

                html += "</div>";

                elm.html(html)
                    .addClass("sa-ajaxed notice");

                // If we have all the notices, place them in the dialog
                if (elm.siblings("li").not(".sa-ajaxed").length === 0) {
                    $dial.html(elm.closest("ul"));

                    // Reposition
                    $dial.dialog("option", "position", $dial.dialog("option", "position"));
                }
            };
        };

        // Wrap <td> numbers in a link that will show <td> details when clicked on.
        $(".sa-table td").each(function() {
            var $this   = $(this),
                caption = $this.closest("table").children("caption").text(),
                content = $this.children("ul"),
                $link   = $("<a href='#'></a>"),
                $num    = $this.children("span");

            if ($num.text() === "0") {
                return;
            }

            $link.on("click", function(e) {
                e.preventDefault();

                var $this = $(this);

                // If we already fetched the data, just show it
                if ($this.hasClass("sa-ajaxed")) {
                    $dial.html(content)
                        .dialog("option", "title", caption)
                        .dialog("open");
                } else {
                    $this.addClass("sa-ajaxed"); // Mark as fetched

                    // Loading indicator
                    $dial.html("<div class='sa-processing'></div>")
                        .dialog("option", "title", caption)
                        .dialog("open");

                    $this.siblings("ul").children("li").each(function() {
                        var $this = $(this);

                        // Notice
                        if ($this.hasClass("sa-notice")) {
                            $this.removeClass("sa-notice");

                            // Fetch notice data
                            $.ajax({
                                url: snRoot + "api/statuses/show.json?id=" + $this.attr("class"),
                                dataType: "json",
                                success: callback($this),
                                error: function() {
                                    // Fall back to non-rich data
                                    $this.addClass("sa-ajaxed");
                                    $dial.html(content)
                                        .dialog("option", "title", caption)
                                        .dialog("open");
                                }
                            });
                        } else { // Profile
                            $dial.html(content)
                                .dialog("option", "title", caption)
                                .dialog("open");
                        }
                    });
                }
            });

            $num.wrap($link);
        });
    };

    buildCustomDate();
    buildDatePicker();
    buildGraphs();
    buildMap();
    enhanceTables();

}(jQuery, window, OpenLayers, Chartist));
