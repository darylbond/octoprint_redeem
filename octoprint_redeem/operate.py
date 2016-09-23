import datetime
import json, time
import subprocess 
import os
import logging
import logging.handlers
import git

my_logger = logging.getLogger('MyLogger')
my_logger.setLevel(logging.DEBUG)
handler = logging.handlers.SysLogHandler(address = '/dev/log')
my_logger.addHandler(handler)

class Operate:
    def __init__(self):
        self.path = "/etc/redeem/"
        self.repo = git.Repo("/usr/src/redeem")

    def get_printers(self):
        """ Get a list of config files """
        import glob
        blacklist = ["default.cfg", "printer.cfg", "local.cfg"]
        try:
            files = [ os.path.basename(f) for f in glob.glob(self.path+"*.cfg") if os.path.isfile(os.path.join(self.path,f)) and os.path.basename(f) not in blacklist ]
            return files
        except OSError: 
            return []

    def get_default_printer(self):
        """ Get the current printer """
        real = os.path.realpath(self.path+"printer.cfg")
        return os.path.basename(real)

    def choose_printer(self, filename):
        """ Choose which printer config should be used """
        path = "/etc/redeem/"
        whitelist = self.get_printers()
        if filename not in whitelist:
            return False
        filename = os.path.join(path,filename)
        linkname = os.path.join(path,"printer.cfg")
        # Only unlink if exists
        if os.path.isfile(linkname):
            os.unlink(linkname)
        # only link if exists
        if os.path.isfile(filename):
            os.symlink(filename, linkname)
            return True
        return False

    def delete_printer(self, filename):
        full = self.path+filename 
        if os.path.isfile(full):
            os.unlink(full)
            return True
        return False        

    def get_local(self, filename):
        with open(filename, "r+") as f:
            return f.read()

    def save_local(self, data, filename):
        logging.info(data)
        with open(filename, "w+") as f:
            f.write(data)
        

    def restart_redeem(self):
        # Octo will need to have sudo privileges to restart redeem for this to work. 
        # Add "%octo ALL=NOPASSWD: /bin/systemctl restart redeem.service" to /etc/sudoers
        logging.warning("Restarting redeem")
        subprocess.call("sudo systemctl restart redeem.service", shell=True)


    def reset_alarm(self):
        # Send M562 to reset the thermistor alarm
        subprocess.call("echo 'M562' > /dev/testing_noret_1", shell=True)

    #
    # Git repository functions
    #
    def upgrade_current_branch(self):
        ''' Upgrades the current branch and '''
        cn = self.get_current_branch()
        local = self.repo.head.ref
        remote = self.repo.remotes.origin.refs[cn]
        self.repo.merge_base(local, remote)
        install_ok = subprocess.call("sudo /usr/bin/make -C /usr/src/redeem install", shell=True)
        if install_ok: 
            self.restart_redeem()
        return {"installation_ok": install_ok}

    def is_current_branch_upgradable(self):
        ''' Return true if the current branch can be upgraded'''
        cn = self.get_current_branch()
        self.repo.remotes.origin.fetch()
        local = self.repo.head.ref
        remote = self.repo.remotes.origin.refs[cn]
        data = {
            "local_version": local.commit.hexsha,
            "remote_version": remote.commit.hexsha,
            "is_upgradable": self.repo.head.commit != self.repo.remotes.origin.refs[cn].commit
        }
        return data

    def get_branches(self):
        return [head.name for head in self.repo.heads]

    def set_current_branch(self, branch):
        self.repo.heads[branch].checkout()

    def get_current_branch(self):
        return self.repo.head.ref.name


if __name__ == "__main__":
    o = Operate()
    print o.get_branches()
    print o.set_current_branch("develop")
    print o.get_current_branch()
    print o.current_branch_upgradable()
    #print o.upgrade_current_branch()

