#!/usr/bin/env python3
"""Publish only backup metadata for the read-only application status view."""
import datetime
import json
import os
import subprocess
from pathlib import Path

def properties(unit):
    output=subprocess.check_output(['systemctl','show',unit,'--property=ActiveState,Result,NextElapseUSecRealtime'],text=True)
    return dict(line.split('=',1) for line in output.splitlines() if '=' in line)

def iso(value):
    if not value or value in ('n/a','0'): return None
    try:
        return subprocess.check_output(['date','-u','-d',value,'+%Y-%m-%dT%H:%M:%SZ'],text=True).strip()
    except subprocess.CalledProcessError: return None

timer=properties('loomi-backup.timer')
service=properties('loomi-backup.service')
files=sorted(p for p in Path('/var/backups/loomi').glob('loomi-????????T??????Z.sqlite') if p.is_file() and p.stat().st_size>0)
latest=files[-1] if files else None
status={'version':1,'updatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'lastSuccessfulAt':None,'sizeBytes':None,'nextScheduledAt':iso(timer.get('NextElapseUSecRealtime')),'scheduleActive':timer.get('ActiveState')=='active','lastAttemptFailed':service.get('Result','success')!='success','running':service.get('ActiveState')=='activating'}
if latest:
    status['lastSuccessfulAt']=datetime.datetime.strptime(latest.stem.removeprefix('loomi-'),'%Y%m%dT%H%M%SZ').replace(tzinfo=datetime.timezone.utc).isoformat()
    status['sizeBytes']=latest.stat().st_size
directory=Path('/var/lib/loomi/backup-status')
directory.mkdir(parents=True,exist_ok=True)
temporary=directory/'status.json.tmp'
temporary.write_text(json.dumps(status)+'\n')
os.chmod(temporary,0o644)
temporary.replace(directory/'status.json')
