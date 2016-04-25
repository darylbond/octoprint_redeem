OctoPrint Plugin for Redeem
=========================

Redeem is the Replicape Daemon and this plugin controls all settings for Redeem. 

This plugin allows restart and configuration of Redeem from OctoPrint.

How to make debian package: 
python setup.py sdist
cd dist
py2dsc-deb -m "Your name <you@yourdomain.com>" OctoPrint-Redeem-0.4.tar.gz

Note: 
Build fails, update /usr/lib/python2.7/dist-packages/octoprint_setuptools/__init__.py
with all={}
