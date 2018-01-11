# coding=utf-8
from __future__ import absolute_import


import logging
import json
import datetime
import os, errno
from os import listdir, unlink
from os.path import isfile, join, isdir

import flask
from octoprint.server.util.flask import redirect_to_tornado
import octoprint.plugin
import octoprint.settings
import time


from .operate import Operate

class RedeemPlugin(
        octoprint.plugin.TemplatePlugin,
        octoprint.plugin.SettingsPlugin,
        octoprint.plugin.StartupPlugin,
        octoprint.plugin.AssetPlugin,
        octoprint.plugin.BlueprintPlugin,
        octoprint.plugin.SimpleApiPlugin,
        octoprint.plugin.OctoPrintPlugin):

    def __init__(self):
        self._logger = logging.getLogger("octoprint.plugins.redeem")

    #~~ StartupPlugin
    def on_after_startup(self):
        self.path   = self._settings.get(["path"])

    #~~ SettingsPlugin
    def on_settings_save(self, data):
        super(RedeemPlugin, self).on_settings_save(data)

    def get_settings_defaults(self):
        return dict(
            path = "/etc/redeem/",
			default_profile=None,
			debug_logging=False
        )

    #~~ AssetPlugin API
    def get_assets(self):
		return {
			"js": ["js/redeem.js"],
			"less": ["less/redeem.less"],
			"css": ["css/redeem.css"]
		}

    #~~ SimpleApiPlugin API
    def get_api_commands(self):
        return dict(
            get_profiles = [],
            use_profile = [],
            delete_profile = [],
            restart_redeem = [],
            redeem_upgrade_current_branch = [],
            redeem_is_current_branch_upgradable = [],
            redeem_get_current_branch = [],
            redeem_set_current_branch = [],
            redeem_get_branches = [],
            reset_thermistor_alarm = [],
            reset_endstop_alarm = [],
            get_profile = [],
            save_local = []
        )

    def on_api_command(self, command, data):
        o = Operate()
        if command == "get_profiles":
            printers = o.get_printers()
            default = o.get_default_printer()
            profiles = {}
            for printer in printers:
                key, _ = os.path.splitext(printer)
                profiles[printer] = {
                    "displayName": key,
                    "description": key,
                    "default": printer == default,
                    "refs": {
                        "resource": flask.url_for("plugin.redeem.download_profile", filename=printer, _external=True),
				        "download": flask.url_for("index", _external=True) + "plugin/redeem/download/" + printer
                    }
                }
            return flask.jsonify(**profiles)
        elif command == "use_profile":
            filename = data["key"]
            if(o.choose_printer(filename)):
                return flask.jsonify(ok=1)
            return flask.jsonify(ok=0)
        elif command == "delete_profile":
            filename = data["key"]
            if(o.delete_printer(filename)):
                return flask.jsonify(ok=1)
            return flask.jsonify(ok=0)
        elif command == "restart_redeem":
            o.restart_redeem()
            return flask.jsonify(ok=1)
        elif command == "redeem_upgrade_current_branch":
            data = o.upgrade_current_branch()
            return flask.jsonify(data = data)
        elif command == "redeem_is_current_branch_upgradable":
            data = o.is_current_branch_upgradable()
            return flask.jsonify(data=data)
        elif command == "redeem_get_current_branch":
            data = o.get_current_branch()
            return flask.jsonify(data=data)
        elif command == "redeem_set_current_branch":
            branchname = data["key"]
            o.set_current_branch(branchname)
            return flask.jsonify(ok=1)
        elif command == "redeem_get_branches":
            data = o.get_branches()
            return flask.jsonify(data=data)
        elif command == "reset_thermistor_alarm":
            o.reset_thermistor_alarm()
            return flask.jsonify(ok=1)
        elif command == "reset_endstop_alarm":
            o.reset_endstop_alarm()
            return flask.jsonify(ok=1)
        elif command == "get_profile":
            filename = data["key"]
            filename_path = os.path.join(self._settings.get(["path"]),filename)
            data = o.get_config_file(filename_path)
            return flask.jsonify(data=data)
        elif command == "save_local":
            filename = os.path.join(self._settings.get(["path"]),"local.cfg")
            o.save_local(data["data"], filename)
            return flask.jsonify(ok=1)
        else:
            self._logger.info("Unknown command: '"+str(line)+"'")

    def on_api_get(self, request):
        return flask.jsonify(foo="bar")

    @octoprint.plugin.BlueprintPlugin.route("/profiles/<filename>", methods=["GET"])
    def download_profile(filename):
        return redirect_to_tornado(request, url_for("index") + "downloads/profiles/" + filename)


    ##~~ BlueprintPlugin API
    @octoprint.plugin.BlueprintPlugin.route("/import", methods=["POST"])
    def import_redeem_profile(self):
        import datetime
        import tempfile

        input_name = "file"
        input_upload_name = input_name + "." + self._settings.global_get(["server", "uploads", "nameSuffix"])
        input_upload_path = input_name + "." + self._settings.global_get(["server", "uploads", "pathSuffix"])

        if input_upload_name in flask.request.values and input_upload_path in flask.request.values:
            filename = flask.request.values[input_upload_name]
            # Parse the Config
            try:
                profile_dict = _check_config_file(flask.request.values[input_upload_path])
            except Exception as e:
                self._logger.exception("Error while converting the imported profile")
                return flask.make_response("Something went wrong while converting imported profile: {message}".format(message=str(e)), 500)

        else:
	        self._logger.warn("No profile file included for importing, aborting")
	        return flask.make_response("No file included", 400)

        if profile_dict is None:
	        self._logger.warn("Could not convert profile, aborting")
	        return flask.make_response("Could not convert Redeem profile", 400)

        name, _ = os.path.splitext(filename)

        # default values for name, display name and description
        profile_name = _sanitize_name(name)
        profile_display_name = name
        profile_description = "Imported from {filename} on {date}".format(filename=filename, date=octoprint.util.get_formatted_datetime(datetime.datetime.now()))
        profile_allow_overwrite = False

        # overrides
        if "name" in flask.request.values:
	        profile_name = flask.request.values["name"]
        if "displayName" in flask.request.values:
	        profile_display_name = flask.request.values["displayName"]
        if "description" in flask.request.values:
	        profile_description = flask.request.values["description"]
        if "allowOverwrite" in flask.request.values:
	        from octoprint.server.api import valid_boolean_trues
	        profile_allow_overwrite = flask.request.values["allowOverwrite"] in valid_boolean_trues

        try:
            from_file = flask.request.values[input_upload_path]
            to_file = "/etc/redeem/"+profile_name+".cfg"
            self._logger.info("Renaming {} to {}".format(from_file, to_file))
            os.rename(from_file, to_file)
        except IOError as e:
	        self._logger.warn("Error renaming file"+str(e))
	        return flask.make_response("Error renaming file. Perhaps wrong permissions".format(**locals()), 409)

        result = dict(
	        resource=flask.url_for("api.slicingGetSlicerProfile", slicer="cura", name=profile_name, _external=True),
	        displayName=profile_display_name,
	        description=profile_description
        )
        r = flask.make_response(flask.jsonify(result), 201)
        r.headers["Location"] = result["resource"]
        return r


    def custom_action_handler(self, comm, line, action, *args, **kwargs):
        #self._logger.info("Received action from printer: '"+str(action)+"'"+str(comm)+" "+str(line))

        [action, message] = action.split("@")

        if action[:6] == "alarm_":
            self._plugin_manager.send_plugin_message("redeem", dict(type=action, data={"message": message}))
        elif action == "filament_sensor":
            timeUTC = int(time.time())
            self._plugin_manager.send_plugin_message("redeem", dict(type=action, data={"message": message, "time": str(timeUTC)}))
        elif action == "display_message":
            timeUTC = int(time.time())
            self._plugin_manager.send_plugin_message("redeem", dict(type=action, data={"message": message, "time": str(timeUTC)}))
        elif action == "bed_probe_point":
            timeUTC = int(time.time())
            self._plugin_manager.send_plugin_message("redeem", dict(type=action, data={"message": message, "time": str(timeUTC)}))
        elif action == "bed_probe_data":
            json_data = json.loads(message)
            data={
                "probe_data": json.dumps(json_data["probe_data"]),
                "probe_type": json_data["probe_type"],
                "replicape_key": json_data["replicape_key"],
                "time": str(int(time.time()))
            }
            self._plugin_manager.send_plugin_message("redeem", dict(type=action, data=data))
        elif action == "pid_tune_data":
            json_data = json.loads(message)
            data={
                "tune_data": json.dumps(json_data["tune_data"]),
                "tune_gcode": json_data["tune_gcode"],
                "replicape_key": json_data["replicape_key"],
                "time": str(int(time.time()))
            }
            self._plugin_manager.send_plugin_message("redeem", dict(type=action, data=data))
        else:
            self._logger.info("Unknown command: '"+str(line)+"'")


    def route_hook(self, server_routes, *args, **kwargs):
        from octoprint.server.util.tornado import LargeResponseHandler, path_validation_factory
        from octoprint.util import is_hidden_path

        return [
            (r"/download/(.*)", LargeResponseHandler, dict(path=self._settings.get(["path"]),
                                                           as_attachment=True,
                                                           path_validation=path_validation_factory(lambda path: not is_hidden_path(path),
                                                                                                   status_code=404)))
        ]



def _check_config_file(config_file):
    from configobj import ConfigObj
    import logging

    ConfigObj(config_file, list_values=False)

    return True

def _sanitize_name(name):
	if name is None:
		return None

	if "/" in name or "\\" in name:
		raise ValueError("name must not contain / or \\")

	import string
	valid_chars = "-_.() {ascii}{digits}".format(ascii=string.ascii_letters, digits=string.digits)
	sanitized_name = ''.join(c for c in name if c in valid_chars)
	sanitized_name = sanitized_name.replace(" ", "_")
	return sanitized_name.lower()

__plugin_name__ = "Redeem Plugin"

def __plugin_load__():
    plugin = RedeemPlugin()

    global __plugin_implementation__
    __plugin_implementation__ = plugin

    global __plugin_hooks__
    __plugin_hooks__ = {
        "octoprint.comm.protocol.action": plugin.custom_action_handler,
        "octoprint.server.http.routes": plugin.route_hook
    }
