# Changes

## 2026-05-22

- [2.11.1] Bug fix in ```serve-route.js```

## 2026-04-25

- [2.11.0] Change options to format value using the new key set by dobo
- [2.11.0] Remove ```options.retainOriginalValue``` since it is not needed anymore
- [2.11.0] Change related header to ```X-Fmt```

## 2026-04-11

- [2.10.0] Add support to format output values using header ```X-Format-Value```
- [2.10.0] Add support to retain original value using header ```X-Retain-Original``` if above key is ```true```

## 2026-04-02

- [2.9.1] Add missing ```hardCapped``` key

## 2026-03-30

- [2.8.0] Add inter site module support
- [2.8.1] Bug fix in ```options.limit```, removed due to use ```findAllRecords()```
- [2.9.0] Add support to show warnings through headers ```X-Warnings```
- [2.9.0] Add support for ```dobo.hardCap``` when ```count``` is requested
- [2.9.0] By default now ALWAYS request ```count``` which can be turned off with through headers ```X-NoCount```


## 2026-03-22

- [2.7.1] bug fix in reference records
- [2.7.2] Bug fix in applying routes to ```webCtx```

## 2026-03-14

- [2.7.0] Accept model's name from ```req.params``` in ```route-by-model-builder.js```

## 2026-03-06

- [2.6.1] Bug fix on schema enforcement. Only apply when it's stated explicitely in route handler

## 2026-03-05

- [2.6.0] Add transaction support by setting property ```transaction: true``` on model's route handler definition

## 2026-02-23

- [2.5.1] Bug fix on ```transformResult()```

## 2026-02-22

- [2.5.0] Add warnings to the response objects

## 2026-02-09

- [2.4.0] Add error & not found handlers

## 2026-02-08

- [2.3.0] Simplify webApp context through ```plugin.webAppCtx```

## 2026-01-30

- [2.2.1] Bug fix if output format is in xml

## 2026-01-24

- [2.2.0] Add ```hooks``` property to model builder that will be considered as dynamic hoooks by models

## 2026-01-16

- [2.1.1] Bug fix on model references

## 2025-12-28

- [2.1.0] Ported to ```bajo@2.2.x``` specs
- [2.1.0] Add waibuRestApi end point ```/api/db/:model/stat/:stat```
