#! /usr/local/bin/node
import convert from "./json-to-php.mjs"
import transformer from 'console-in-transformer'

transformer(data => {
	return convert(JSON.parse(data))
}, '')