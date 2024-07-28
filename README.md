# OpenBouffalo Data Generator

This repo contains JavaScript scripts for generating various useful data types from hardware describing YAML files,
found in [bouffalo-data](https://github.com/openbouffalo/bouffalo-data) and [bouffalo-vendor-data](https://github.com/openbouffalo/bouffalo-data).

*Tools are in early stages, expect poor code.*

# SVD Generator

Generates SVD, which can be used for generation of Rust code, or in IDE's for nice register lookups.
Tool is in good shape, but some hard-coded stuff are here, so it's messy to use. Will be improved soon.

# C Header Generator

Generates headers for C HAL and SDK (WIP). Tool is work in progress, so it's messy to use (for now).