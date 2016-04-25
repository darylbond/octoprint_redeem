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
                    command: "get_local"
                }),
                success: function(data) {
                    $("#settings_plugin_redeem_textarea").val(data["data"]);
                }
            });
            $("#settings_plugin_redeem_editor").modal("show");
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

        self.removeThermistorPopups = function(){
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
                    command: "reset_alarm"
                }),
                success: function() {
                    self.removeThermistorPopups();
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
                case "alarm_stepper_fault":{
                    options = {
                        title: "Stepper fault!",
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
                case "alarm_operational":{
                    options = {
                        title: "Redeem operational",
                        text: messageData.message,
                        type: "info"
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
