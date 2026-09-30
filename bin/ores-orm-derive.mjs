#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { deriveOrmProjection, selectPublic, buildArtifacts } from '../src/orm-derived/index.mjs';
const args=Object.fromEntries(process.argv.slice(2).flatMap((v,i,a)=>v.startsWith('--')?[[v.slice(2),a[i+1]]]:[]));
for(const k of ['diesel','seaorm','policy','out'])if(!args[k])throw new Error(`missing --${k}`);
const [dieselSource,seaOrmSource,policyText]=await Promise.all([fs.readFile(args.diesel,'utf8'),fs.readFile(args.seaorm,'utf8'),fs.readFile(args.policy,'utf8')]);
const policy=JSON.parse(policyText),full=deriveOrmProjection({dieselSource,seaOrmSource,namespace:policy.source_namespace||'orm.derived'}),pub=selectPublic(full,policy),files=buildArtifacts(pub);
const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
for(const [rel,content] of Object.entries(files)){const p=path.join(args.out,rel);await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p,content)}
await fs.writeFile(path.join(args.out,'receipt.json'),JSON.stringify({schema:'ores.orm-derived-receipt/v1',diesel_sha256:digest(dieselSource),seaorm_sha256:digest(seaOrmSource),policy_sha256:digest(policyText),outputs:Object.fromEntries(Object.entries(files).map(([k,v])=>[k,digest(v)]))},null,2)+'\n');
