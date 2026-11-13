#! /usr/local/bin/node
import convert from "./php-to-json.mjs"
import transformer from 'console-in-transformer'

transformer(data => {
	return JSON.stringify(convert(data), null, '\t')
}, '\n')