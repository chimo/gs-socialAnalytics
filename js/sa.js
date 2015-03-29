/*global jQuery: false, ol: false, Chartist: false*/
( function( $, window, OpenLayers, Chartist ) {
    "use strict";

    /**
     * <details> polyfill
     */
    $( "details" ).details();
    $( "html" ).addClass( $.fn.details.support ? "details" : "no-details" );

    /**
     * Bootstrap clearfix
     */
    $( ".container-fluid .col-md-6.sa-cell" ).each( function( i ) {
        if ( i % 2 !== 0 ) {
            $( "<div class='clearfix'></div>" ).insertAfter( this );
        }
    } );

    /**
     * Social analytics
     */
    $( "#wrap" ).addClass( "sa-js" );

    var buildCustomDate,
        buildDatePicker,
        buildGraphs,
        buildLineGraphLegend,
        buildLineGraphs,
        buildMap,
        buildPieCharts,
        enhanceTables,
        nativeDatePicker,
        sum,
        snRoot = window.location.pathname.replace( /(\/index\.php)?\/social$/, "/" );

    buildMap = function() {
        var map,
            tiles = new ol.layer.Tile( { source: new ol.source.OSM() } ),
            layers = [ tiles ],
            createPopup,
            createStyle,
            createSourceVector,
            SA = window.SA,
            followingCoords,
            followersCoords;

        // Bail if we don't have any map data.
        if ( !SA ) {
            return;
        }

        followingCoords = SA.followingCoords;
        followersCoords = SA.followersCoords;

        /**
         * Create map marker style
         *
         * @param src String URL to image
         */
        createStyle = function( src ) {
            return new ol.style.Style(
                {
                    image: new ol.style.Icon(
                        {
                            anchor: [ 0.5, 46 ],
                            anchorXUnits: "fraction",
                            anchorYUnits: "pixels",
                            opacity: 0.75,
                            src: src
                         }
                    )
                }
            );
        };

        /**
         * Create source vector
         */
        createSourceVector = function( items ) {
            var sourceVector = new ol.source.Vector( {} ),
                i,
                len,
                icon,
                item;

            for ( i = 0, len = items.length; i < len; i += 1 ) {
                item = items[i];

                icon = new ol.Feature( {
                    geometry: new ol.geom.Point( ol.proj.transform( [ item.lon, item.lat ], "EPSG:4326", "EPSG:3857" ) ),
                    profileUrl: item.profileUrl
                } );

                sourceVector.addFeature( icon );
            }

            return sourceVector;
        };

        /**
         * Create popup
         */
        createPopup = function( map ) {
            var element = document.getElementById( "sa-popup" ),
                popup = new ol.Overlay( {
                    element: element,
                    positioning: "bottom-center",
                    stopEvent: false
                } );

            map.addOverlay( popup );

            // display popup on click
            map.on( "click", function( evt ) {
                var feature,
                    geometry,
                    coord,
                    profileUrl,
                    html,
                    $element = $( element );

                feature = map.forEachFeatureAtPixel( evt.pixel,
                    function( feature ) {
                        return feature;
                    } );

                if ( feature ) {
                    profileUrl = feature.get( "profileUrl" );
                    geometry = feature.getGeometry();

                    coord = geometry.getCoordinates();
                    popup.setPosition( coord );

                    html = $( "a.url[href='" + profileUrl + "']" )
                                .first()
                                .closest( "li" )
                                .html();

                    $element
                        .html( "<a href='#' class='sa-close'>x</a>" + html )
                        .show();
                } else {
                    $element.hide();
                }
            } );

            $( document ).on( "click", ".sa-close", function( e ) {
                e.preventDefault();

                element.style.display = "none";
            } );

            // Change mouse cursor when over marker
            $( map.getViewport() ).on( "mousemove", function( e ) {
                var pixel,
                    hit,
                    target;

                target = map.getTarget();
                pixel = map.getEventPixel( e.originalEvent );

                hit = map.forEachFeatureAtPixel( pixel, function() {
                    return true;
                } );

                if ( hit ) {
                    target.style.cursor = "pointer";
                } else {
                    target.style.cursor = "";
                }
            } );
        };

        // If we have coords available for new subscriptions,
        // create map layer with markers
        if ( followingCoords ) {
            layers.push(
                new ol.layer.Vector(
                    {
                        source: createSourceVector( followingCoords ),
                        style: createStyle( snRoot + "plugins/SocialAnalytics/images/marker-green.png" )
                    }
                )
            );
        }

        // If we have coords available for new subscribers,
        // create map layer with markers
        if ( followersCoords ) {
            layers.push(
                new ol.layer.Vector(
                    {
                        source: createSourceVector( followersCoords ),
                        style: createStyle( snRoot + "plugins/SocialAnalytics/images/marker-red.png" )
                    }
                )
            );
        }

        // Create map
        map  = new ol.Map( {
            target: document.getElementById( "sa-map" ),
            layers: layers,
            view: new ol.View( {
                center: [ 0, 0 ],
                zoom: 1
            } )
        } );

        createPopup( map );
    };

    /**
     * Whether the browser supports HTML5 date picker (type="date")
     *
     * `true` or `false`
     */
    nativeDatePicker = ( function() {
        var i = document.createElement( "input" );

        i.setAttribute( "type", "date" );

        return i.type !== "text";
    }() );

    /**
     * "Custom date range" link
     */
    buildCustomDate = function() {
            // Show/hide custom date form
            $( ".sa-cust a" ).on( "click", function( e ) {
                e.preventDefault();

                var $link = $( this );

                $link
                    .parent() // TODO: ARIA
                    .find( ".sa-picker" )
                    .fadeToggle();
            } );
    };

    /**
     * Invoke jQueryUI's datepicker if the browser doesn't support type="date"
     * natively
     */
    buildDatePicker = function() {
        if ( !nativeDatePicker ) {
            $( "#sa-date-s, #sa-date-e" ).datepicker( {
                buttonImage: snRoot + "plugins/SocialAnalytics/images/calendar.png",
                buttonImageOnly: true,
                changeMonth: true,
                changeYear: true,
                dateFormat: "yy-mm-dd",
                maxDate: new Date(),
                showOn: "button"
            } );
        }
    };

    /**
     * Click event on legend labels
     */
    $( document ).on( "click", ".sa-legend a", function( e ) {
        e.preventDefault();

        var $link = $( this ),
            $svg = $link.closest( "figure" ).find( "svg" ),
            seriesName = $link.data( "name" ),
            $line = $svg.find( ".ct-series" ).filter( "[ct\\:series-name='" + seriesName + "']" );

        $line.get( 0 ).classList.toggle( "sa-hide" );
    } );

    /**
     * Build graph legend
     */
    buildLineGraphLegend = function( data ) {
        var $svg = $( data.svg._node ),
            $container,
            $series,
            html;

        // Don't build more than one legend
        // Necessary since the "create" event can be triggered more than once
        // TODO: try unbinding the event while in here.
        if ( $svg.closest( "figure" ).find( ".sa-legend" ).length > 0 ) {
            return;
        }

        $container = $( "<ul class='sa-legend'></ul>" ).insertAfter( $svg.closest( ".ct-chart" ) );
        $series = $svg.find( ".ct-series" );
        html = "";

        $series.each( function() {
            var $this = $( this ),
                label = $this.attr( "ct:series-name" ),
                color = $this.find( ".ct-line" ).css( "stroke" );

            html += "<li><span style='color: " + color + "'>■</span>&nbsp;<a data-name='" + label + "' href='#'>" + label + "</a></li>";
        } );

        $container.html( html );
    };

    /**
     * Build line graphs
     */
    buildLineGraphs = function() {
        var $tables = $( ".sa-line" );

        $tables.each( function() {
            var chart,
                $table = $( this ),
                $headers = $table.find( "thead th" ),
                $contentRows = $table.find( "tbody tr" ),
                series = [],
                seriesData = [],
                labels = [],
                i,
                len,
                data,
                $graphContainer,
                $tooltip;

            $graphContainer = $( "<div class='ct-chart'><div class='tooltip' style='display: none;'></div></div>" ).insertBefore( $table.closest( "details" ) );
            $tooltip = $graphContainer.find( ".tooltip" );

            // Prepare arrays for the different series
            for ( i = 0, len = $headers.length; i < len; i += 1 ) {
                seriesData.push( [] );
            }

            // Gather series data and labels
            $contentRows.each( function() {
                var $row = $( this );

                // Labels: only keep the day (ex: 2014-01-02 becomes 02)
                labels.push( $row.children( "th" ).text().split( "-" )[ 2 ] );

                // Data
                $row.children( "td" ).each( function( j ) {
                    var $cell = $( this );

                    seriesData[ j ].push( parseInt( $cell.text(), 10 ) );
                } );
            } );

            // Associate names (columns) with series data (rows)
            for ( i = 0, len = seriesData.length; i < len; i += 1 ) {
                series.push( {
                    name: $headers.eq( i ).text(),
                    data: seriesData[ i ]
                } );
            }

            // Object required by chartist
            data = {
                "labels": labels,
                "series": series
            };

            // Build graph
            chart = new Chartist.Line( $graphContainer.get( 0 ), data );

            // Build the legend after the graph has been created
            chart.on( "created", buildLineGraphLegend );

            /**
             * TODO: Also show tooltip on focus (for mobile, keyboard)
             */

            $graphContainer
                // Show tooltip when cursor is over point
                .on( "mouseenter", ".ct-point", function() {
                    var $point = $( this ),
                        value = $point.attr( "ct:value" ),
                        seriesName = $point.parent().attr( "ct:series-name" );

                    $tooltip
                        .html( value + "<br>" + seriesName )
                        .show();
                } )
                // Hide tooltip when cursor leaves graph
                .on( "mouseleave", ".ct-point", function() {
                   $tooltip.hide();
                } )
                // Position tooltip in relation to the cursor
                .on( "mousemove", function( event ) {
                    $tooltip.css( {
                        left: ( event.offsetX || event.originalEvent.layerX ) - $tooltip.width() / 2 - 10,
                        top: ( event.offsetY || event.originalEvent.layerY ) - $tooltip.height() - 40
                    } );
                } );
        } );
    };

    /**
     * Add two numbers
     */
    sum = function( a, b ) {
        return a + b;
    };

    /**
     * Build pie charts
     */
    buildPieCharts = function() {
        var $tables = $( ".sa-pie" );

        $tables.each( function() {
            var $table = $( this ),
                $tr = $table.find( "tbody tr" ),
                series = [],
                labels = [],
                $graph,
                data;

            $graph = $( "<div class='ct-chart ct-octave'></div>" ).insertBefore( $table.closest( "details" ) );

            $tr.each( function() {
                var $row = $( this ),
                    num = parseInt( $row.find( "td" ).text(), 10 ),
                    label = $row.find( "th" ).text();

                series.push( num );
                labels.push( label );
            } );

            data = {
                "series": series,
                "labels": labels
            };

            new Chartist.Pie( $graph.get( 0 ), data, {
                chartPadding: 30,
                labelDirection: "explode",
                labelOffset: 100
            } );
        } );
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
            $dial = $( "<div id='sa-dialog'></div>" ).dialog( {
                autoOpen: false,
                modal: true,
                width: 700
            } ).css( "max-height", $( window ).height() );

        callback = function( elm ) {
            return function( data ) {
                var date = new Date( data.created_at ), // TODO: handle cases when this fails
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
                         "<abbr class='published' title='" + data.created_at  + "'>" + date.toISOString().split( "T" )[ 0 ] + "</abbr>" +
                        "</a>" +
                         "<span class='source'>from <span class='device'>" +
                          "<a href='" + snRoot + "notice/" + data.id + "' rel='external'>" + data.source + "</a>" +
                         "</span>" +
                        "</span>";

                // If it's a repeat or a reply, show in context link
                if ( typeof data.retweeted_status !== "undefined" || data.in_reply_to_user_id !== null ) {
                    html += "<a class='response' href='" + snRoot + "conversation/" +
                        data.statusnet_conversation_id + "#notice-" + data.id + "'>in context</a>";
                }

                html += "</div>";

                elm.html( html )
                    .addClass( "sa-ajaxed notice" );

                // If we have all the notices, place them in the dialog
                if ( elm.siblings( "li" ).not( ".sa-ajaxed" ).length === 0 ) {
                    $dial.html( elm.closest( "ul" ) );

                    // Reposition
                    $dial.dialog( "option", "position", $dial.dialog( "option", "position" ) );
                }
            };
        };

        // Wrap <td> numbers in a link that will show <td> details when clicked on.
        $( ".sa-table td" ).each( function() {
            var $this   = $( this ),
                caption = $this.closest( "table" ).children( "caption" ).text(),
                content = $this.children( "ul" ),
                $link   = $( "<a href='#'></a>" ),
                $num    = $this.children( "span" );

            if ( $num.text() === "0" ) {
                return;
            }

            $link.on( "click", function( e ) {
                e.preventDefault();

                var $this = $( this );

                // If we already fetched the data, just show it
                if ( $this.hasClass( "sa-ajaxed" ) ) {
                    $dial.html( content )
                        .dialog( "option", "title", caption )
                        .dialog( "open" );
                } else {
                    $this.addClass( "sa-ajaxed" ); // Mark as fetched

                    // Loading indicator
                    $dial.html( "<div class='sa-processing'></div>" )
                        .dialog( "option", "title", caption )
                        .dialog( "open" );

                    $this.siblings( "ul" ).children( "li" ).each( function() {
                        var $this = $( this );

                        // Notice
                        if ( $this.hasClass( "sa-notice" ) ) {
                            $this.removeClass( "sa-notice" );

                            // Fetch notice data
                            $.ajax( {
                                url: snRoot + "api/statuses/show.json?id=" + $this.attr( "class" ),
                                dataType: "json",
                                success: callback( $this ),
                                error: function() {
                                    // Fall back to non-rich data
                                    $this.addClass( "sa-ajaxed" );
                                    $dial.html( content )
                                        .dialog( "option", "title", caption )
                                        .dialog( "open" );
                                }
                            } );
                        } else { // Profile
                            $dial.html( content )
                                .dialog( "option", "title", caption )
                                .dialog( "open" );
                        }
                    } );
                }
            } );

            $num.wrap( $link );
        } );
    };

    buildCustomDate();
    buildDatePicker();
    buildGraphs();
    buildMap();
    enhanceTables();

}( jQuery, window, ol, Chartist ) );
