$(function() {
    function RedeemViewModel(parameters) {
        var self = this;

        self.loginState = parameters[0];
        self.settingsViewModel = parameters[1];

        self.popup = undefined;

        self.fileName = ko.observable();

        self.placeholderName = ko.observable();
        self.placeholderDisplayName = ko.observable();
        self.placeholderDescription = ko.observable();

        self.profileName = ko.observable();
        self.profileDisplayName = ko.observable();
        self.profileDescription = ko.observable();
        self.profileAllowOverwrite = ko.observable(true);

        self.uploadElement = $("#settings-redeem-import");
        self.uploadButton = $("#settings-redeem-import-start");

        self.saveButton = $("#settings-redeem-editor-save");

        self.profiles = new ItemListHelper(
            "plugin_redeem_profiles",
            {
                "id": function(a, b) {
                    if (a["key"].toLocaleLowerCase() < b["key"].toLocaleLowerCase()) return -1;
                    if (a["key"].toLocaleLowerCase() > b["key"].toLocaleLowerCase()) return 1;
                    return 0;
                },
                "name": function(a, b) {
                    // sorts ascending
                    var aName = a.name();
                    if (aName === undefined) {
                        aName = "";
                    }
                    var bName = b.name();
                    if (bName === undefined) {
                        bName = "";
                    }

                    if (aName.toLocaleLowerCase() < bName.toLocaleLowerCase()) return -1;
                    if (aName.toLocaleLowerCase() > bName.toLocaleLowerCase()) return 1;
                    return 0;
                }
            },
            {},
            "id",
            [],
            [],
            5
        );

        self._sanitize = function(name) {
            return name.replace(/[^a-zA-Z0-9\-_\.\(\) ]/g, "").replace(/ /g, "_");
        };

        self.uploadElement.fileupload({
            dataType: "json",
            maxNumberOfFiles: 1,
            autoUpload: false,
            add: function(e, data) {
                if (data.files.length == 0) {
                    return false;
                }

                self.fileName(data.files[0].name);

                var name = self.fileName().substr(0, self.fileName().lastIndexOf("."));
                self.placeholderName(self._sanitize(name).toLowerCase());
                self.placeholderDisplayName(name);
                self.placeholderDescription("Imported from " + self.fileName() + " on " + formatDate(new Date().getTime() / 1000));

                self.uploadButton.unbind("click");
                self.uploadButton.on("click", function() {
                    var form = {
                        allowOverwrite: self.profileAllowOverwrite()
                    };

                    if (self.profileName() !== undefined) {
                        form["name"] = self.profileName();
                    }
                    if (self.profileDisplayName() !== undefined) {
                        form["displayName"] = self.profileDisplayName();
                    }
                    if (self.profileDescription() !== undefined) {
                        form["description"] = self.profileDescription();
                    }

                    data.formData = form;
                    data.submit();
                });
            },
            done: function(e, data) {
                self.fileName(undefined);
                self.placeholderName(undefined);
                self.placeholderDisplayName(undefined);
                self.placeholderDescription(undefined);
                self.profileName(undefined);
                self.profileDisplayName(undefined);
                self.profileDescription(undefined);
                self.profileAllowOverwrite(true);

                $("#settings_plugin_redeem_import").modal("hide");
                self.requestData();
            }
        });

        self.removeProfile = function(data) {
            self.profiles.removeItem(function(item) {
                return (item.key == data.key);
            });

            $.ajax({
                url:  API_BASEURL + "plugin/redeem",
                type: "POST",
                dataType: "json",
                contentType: "application/json; charset=UTF-8",
                data: JSON.stringify({
                    command: "delete_profile",
                    key: data.key
                }),
                success: function() {
                    self.requestData();
                }
            });
        };

        self.makeProfileDefault = function(data) {
            _.each(self.profiles.items(), function(item) {
                item.isdefault(false);
            });
            var item = self.profiles.getItem(function(item) {
                return item.key == data.key;
            });
            if (item !== undefined) {
                item.isdefault(true);
            }

            $.ajax({
                url:  API_BASEURL + "plugin/redeem",
                type: "POST",
                dataType: "json",
                contentType: "application/json; charset=UTF-8",
                data: JSON.stringify({
                    command: "use_profile",
                    default: true,
                    key: data.key
                }),
                success: function() {
                    self.requestData();
                }
            });
        };

        self.showImportProfileDialog = function() {
            $("#settings_plugin_redeem_import").modal("show");
        };

        self.showEditLocalDialog = function() {
            $.ajax({
                url:  API_BASEURL + "plugin/redeem",
                type: "POST",
                dataType: "json",
                contentType: "application/json; charset=UTF-8",
                data: JSON.stringify({
                    command: "get_profile",
                    key: "local.cfg"
                }),
                success: function(data) {
                    $("#settings_plugin_redeem_textarea").val(data["data"]);
                }
            });
            $("#settings_plugin_redeem_editor").modal("show");
        };

        self.showViewProfileDialog = function(filename) {
            $.ajax({
                url:  API_BASEURL + "plugin/redeem",
                type: "POST",
                dataType: "json",
                contentType: "application/json; charset=UTF-8",
                data: JSON.stringify({
                    command: "get_profile",
                    key: filename
                }),
                success: function(data) {
                    
                    $("#settings_plugin_redeem_textarea_viewer").val(data["data"]);
                }
            });
            $("#settings_plugin_redeem_config_viewer").text('Viewer for config file '+filename);
            $("#settings_plugin_redeem_viewer").modal("show");
        };


        self.saveLocal = function() {
            $.ajax({
                url:  API_BASEURL + "plugin/redeem",
                type: "POST",
                dataType: "json",
                contentType: "application/json; charset=UTF-8",
                data: JSON.stringify({
                    command: "save_local",
                    data: $("#settings_plugin_redeem_textarea").val()
                }),
                success: function() {
                    $("#settings_plugin_redeem_editor").modal("hide");
                }
            });
        };


        self.restartRedeem = function() {
            $.ajax({
                url:  API_BASEURL + "plugin/redeem",
                type: "POST",
                dataType: "json",
                contentType: "application/json; charset=UTF-8",
                data: JSON.stringify({
                    command: "restart_redeem"
                }),
                success: function() {
                    options = {
                        title: "Redeem restarted",
                        text: "Please press connect",
                        type: "info"
                    };
                    self._showPopup(options);
                }
            });
        };

        /* Upgrade Redeem */
        self.upgradeRedeem = function() {
            $.ajax({
                url:  API_BASEURL + "plugin/redeem",
                type: "POST",
                dataType: "json",
                contentType: "application/json; charset=UTF-8",
                data: JSON.stringify({
                    command: "redeem_upgrade_current_branch"
                }),
                success: function() {
                    options = {
                        title: "Redeem upgraded",
                        text: "Please press connect",
                        type: "info"
                    };
                    self._showPopup(options);
                }
            });
        };

        /* Check for software updates */
        self.checkForUpdates = function() {
            $.ajax({
                url:  API_BASEURL + "plugin/redeem",
                type: "POST",
                dataType: "json",
                contentType: "application/json; charset=UTF-8",
                data: JSON.stringify({
                    command: "redeem_is_current_branch_upgradable"
                }),
                success: function(ret) {
                    data = ret.data
                    console.log(data)
                    console.log(data["is_upgradable"])
                    if(data["is_upgradable"]){
                        options = {
                            title: "A new version is available",
                            text: "Current version: "+data["local_version"]+"<br>Avaliable upgrade: "+data["remote_version"],
                            type: "info",
                            hide: false,
                            confirm: {
                                confirm: true,
                                buttons: [{
                                    text: gettext("Upgrade now"),
                                    click: function () {
                                        self.upgradeRedeem();
                                    }
                                }]
                            },
                        };
                    }
                    else{
                        options = {
                            title: "Redeem is up to date",
                            text: "Current version is "+data["local_version"],
                            type: "success"
                        };
                    }
                    self._showPopup(options);
                }
            });
        };


        self.requestData = function() {
            $.ajax({
                url: API_BASEURL + "plugin/redeem",
                type:"POST",
                dataType: "json",
                contentType: "application/json; charset=UTF-8",
                data: JSON.stringify({
                    "command": "get_profiles"
                }),
                success: self.fromResponse
            });
        };

        self.fromResponse = function(data) {
            var profiles = [];
            _.each(_.keys(data), function(key) {
                profiles.push({
                    key: key,
                    name: ko.observable(data[key].displayName),
                    description: ko.observable(data[key].description),
                    isdefault: ko.observable(data[key].default),
                    refs: {
                        resource: ko.observable(data[key].refs.resource),
                        download: ko.observable(data[key].refs.download)
                    }
                });
            });
            self.profiles.updateItems(profiles);
        };

        self.onBeforeBinding = function () {
            self.settings = self.settingsViewModel.settings;
            self.requestData();
        };

        self.onAfterBinding = function () {
        };

        self.removePopups = function(){
            console.log("Remove popups");
            self._closePopup();
        };

        // Reset the thermistor alarm
        self.resetThermistorAlarm = function() {
            $.ajax({
                url:  API_BASEURL + "plugin/redeem",
                type: "POST",
                dataType: "json",
                contentType: "application/json; charset=UTF-8",
                data: JSON.stringify({
                    command: "reset_thermistor_alarm"
                }),
                success: function() {
                    self.removePopups();
                }
            });
        };

        // Reset the endstop alarm
        self.resetEndstopAlarm = function() {
            $.ajax({
                url:  API_BASEURL + "plugin/redeem",
                type: "POST",
                dataType: "json",
                contentType: "application/json; charset=UTF-8",
                data: JSON.stringify({
                    command: "reset_endstop_alarm"
                }),
                success: function() {
                    self.removePopups(); // TODO
                }
            });
        };

        // Reset all alarms
        self.resetAllAlarms = function() {
            $.ajax({
                url:  API_BASEURL + "plugin/redeem",
                type: "POST",
                dataType: "json",
                contentType: "application/json; charset=UTF-8",
                data: JSON.stringify({
                    command: "reset_all_alarm"
                }),
                success: function() {
                    self.removePopups(); // TODO
                }
            });
        };

        // Upload and view data
        self.uploadAndViewBedData = function(data_type, probe_data, replicape_key) {
            $.ajax({
                url:  "http://review.thing-printer.com/api/index.php/post_probe_data/"+replicape_key,
                type: "POST",
                dataType: "json",
                contentType: "application/json; charset=UTF-8",
                data: JSON.stringify({
                    type: data_type,
                    json_data: probe_data,
                    show_mesh: true,
                    show_markers: true
                }),
                success: function() {
                    console.log("Data upload OK");
                    window.open('http://review.thing-printer.com/?key='+replicape_key);
                    self._closePopup();
                }
            });
        };

        self._showPopup = function(options, eventListeners) {
            self._closePopup();
            self.popup = new PNotify(options);
            if (eventListeners) {
                var popupObj = self.popup.get();
                _.each(eventListeners, function(value, key) {
                    popupObj.on(key, value);
                })
            }
        };

        self._updatePopup = function(options) {
            if (self.popup === undefined) {
                self._showPopup(options);
            } else {
                self.popup.update(options);
            }
        };

        self._closePopup = function() {
            if (self.popup !== undefined) {
                self.popup.remove();
            }
        };


        self.onDataUpdaterPluginMessage = function(plugin, data) {
            if (plugin != "redeem") {
                return;
            }

            var messageType = data.type;
            var messageData = data.data;

            var options = undefined;

            console.log(JSON.stringify(messageData));

            switch (messageType) {
                case "alarm_thermistor_error":{
                    options = {
                        title:  "Thermistor error!",
                        text: messageData.message,
                        type: "error",
                        hide: false,
                        confirm: {
                            confirm: true,
                            buttons: [{
                                text: gettext("Reset alarm"),
                                click: function () {
                                    self.resetAllAlarms();
                                }
                            }]
                        },
                        buttons: {
                            closer: false,
                            sticker: false
                        }
                    };
                    break;
                }
                case "alarm_heater_too_cold":{
                    options = {
                        title: "Heater too cold!",
                        text: messageData.message,
                        type: "error",
                        hide: false,
                        confirm: {
                            confirm: true,
                            buttons: [{
                                text: gettext("Reset alarm"),
                                click: function () {
                                    self.resetAllAlarms();
                                }
                            }]
                        },
                        buttons: {
                            closer: false,
                            sticker: false
                        }
                    };
                    break;
                }
                case "alarm_heater_too_hot":{
                    options = {
                        title: "Heater too hot!",
                        text: messageData.message,
                        type: "error",
                        hide: false,
                        confirm: {
                            confirm: true,
                            buttons: [{
                                text: gettext("Reset alarm"),
                                click: function () {
                                    self.resetAllAlarms();
                                }
                            }]
                        },
                        buttons: {
                            closer: false,
                            sticker: false
                        }
                    };
                    break;
                }
                case "alarm_heater_rising_fast":{
                    options = {
                        title: "Heater rising too fast!",
                        text: messageData.message,
                        type: "error",
                        hide: false,
                        confirm: {
                            confirm: true,
                            buttons: [{
                                text: gettext("Reset alarm"),
                                click: function () {
                                    self.resetAllAlarms();
                                }
                            }]
                        },
                        buttons: {
                            closer: false,
                            sticker: false
                        }
                    };
                    break;
                }
                case "alarm_heater_rising_slow":{
                    options = {
                        title: "Unattached sensor!",
                        text: messageData.message,
                        type: "error",
                        hide: false,
                        confirm: {
                            confirm: true,
                            buttons: [{
                                text: gettext("Reset alarm"),
                                click: function () {
                                    self.resetThermistorAlarm();
                                }
                            }]
                        },
                        buttons: {
                            closer: false,
                            sticker: false
                        }
                    };
                    break;
                }
                case "alarm_heater_falling_fast":{
                    options = {
                        title: "Heater falling fast!",
                        text: messageData.message,
                        type: "error",
                        hide: false,
                        confirm: {
                            confirm: true,
                            buttons: [{
                                text: gettext("Reset alarm"),
                                click: function () {
                                    self.resetThermistorAlarm();
                                }
                            }]
                        },
                        buttons: {
                            closer: false,
                            sticker: false
                        },
                    };
                    break;
                }
                case "alarm_endstop_hit":{
                    options = {
                        title: "Endstop hit unexpectedly!",
                        text: messageData.message,
                        type: "error",
                        hide: false,
                        confirm: {
                            confirm: true,
                            buttons: [{
                                text: gettext("Reset alarm"),
                                click: function () {
                                    self.resetAllAlarms();
                                }
                            }]
                        },
                        buttons: {
                            closer: false,
                            sticker: false
                        },
                    };
                    break;
                }
                case "alarm_stepper_fault":{
                    options = {
                        title: "Stepper fault!",
                        text: messageData.message,
                        type: "error",
                        hide: false,
                        buttons: {
                            closer: true,
                            sticker: false
                        }
                    };
                    break;
                }
                case "alarm_filament_jam":{
                    options = {
                        title: "Filament Jam!",
                        text: messageData.message,
                        type: "error",
                        hide: false,
                        buttons: {
                            closer: true,
                            sticker: true
                        }
                    };
                    break;
                }
                case "alarm_config_error":{
                    options = {
                        title: "Configuration Error!",
                        text: messageData.message,
                        type: "error",
                        hide: false,
                        buttons: {
                            closer: false,
                            sticker: false
                        }
                    };
                    break;
                }
                case "alarm_operational":{
                    options = {
                        title: "Redeem operational",
                        text: messageData.message,
                        type: "info"
                    };
                    break;
                }
                case "bed_probe_data":{
                    options = {
                        title: "Bed probe data ready",
                        text: "Click to upload and view",
                        type: "info",
                        hide: false,
                        confirm: {
                            confirm: true,
                            buttons: [{
                                text: gettext("View data"),
                                click: function () {
                                  self.uploadAndViewBedData(
                                      messageData.probe_type,
                                      messageData.probe_data,
                                      messageData.replicape_key);
                                }
                            }]
                        },
                        buttons: {
                            closer: true,
                            sticker: false
                        }
                    };
                    break;
                }
                case "software_update_ready":{
                    options = {
                        title: "New Redeem software available",
                        text: messageData.message,
                        type: "info", 
                        buttons: {
                            closer: true,
                            sticker: false
                        }
                    };
                    break;
                }
                case "filament_sensor":{
                    break;
                }
            }
            if(options !== undefined){
                self._showPopup(options);
            }
        };
    }

    // view model class, parameters for constructor, container to bind to
    OCTOPRINT_VIEWMODELS.push([
        RedeemViewModel,
        ["loginStateViewModel", "settingsViewModel"],
        "#settings_plugin_redeem"
    ]);
});
