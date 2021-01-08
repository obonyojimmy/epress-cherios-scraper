// requests library
const axios = require("axios");

// your choice of HTML parser
const cheerio = require("cheerio");
const jsdom = require("jsdom");

const express = require("express");

// the scrape endpoint
const ENDPOINT = 'http://quotes.toscrape.com'

// simple persistent storage interface
var quotesStore = new Map()
var authorStore = new Map()

// service interfaces
class Quotes {
  _domSelector = 'div.quote'
  
  // constructor(){}
  
  async getAll(){
    if(quotesStore.size === 0){
       await this.fetch()
    }
    
    // TODO: Generator Iterator would work best
    const resp = []
    quotesStore.forEach((val) => {
      resp.push(...val)
    })
    
    return resp
  }
  
  async getByAuthor(author){
    if(quotesStore.size === 0){
       await this.fetch()
    }
    return quotesStore.get(author)
  }
  
  // TODO ! TODO!
  async getByTag(tag){
    if(quotesStore.size === 0){
       await this.fetch()
    }
    
    const resp = []
    quotesStore.forEach((val) => {
      resp.push(...val)
    })
    
    return resp
  }
  
  
  /**
   * @description Save to db
   */
  save (doc){
    if(quotesStore.has(doc.author)){
      const docs = quotesStore.get(doc.author)
      quotesStore.set(doc.author, [...docs, doc])
    } else {
      quotesStore.set(doc.author, [doc]) // store to quotes table
      authorStore.set(doc.author, {}) // init store to author, will be updated by author class later
    }
  }
  
  
  /**
  * @description fetches and returns quotes Array
  */
  async fetch (){
    const data = await axios.get(ENDPOINT).then(r => r.data)
    const self = this
    const $ = cheerio.load(data)
    $(this._domSelector).each((indx, elm)=> {
      const author = $(elm).children('span.text')
      const text = $(elm).children('span small.author').text()
      const tags = $(elm).children('a.tag').each(c => c.text())
      // const link = author.nextSibling().attr('href')
      const raw = {
        author: author.text(),
        text, 
        tags, 
        // link
      }
      self.save(raw)
    })
  }
}

// TODO
class Authors {
  
  // private method 
  async _init(name){
    if(name){
      // process known authors
      const link = `author/${name}/`
      return this.fetch(link)
    }
    
    if(authorStore.size === 0){
      // for getAll Authors , when store is empty
      if(quotesStore.size === 0){
        // init dependant store 'quotes' when its empty too
        const quotes = new Quotes()
        await quotes.fetch()
      }
      for (let key of quotesStore.keys()) {
        const link = `author/${key}/`
        await this.fetch(link)
      }
    }
  }
  
  async getAll(){
    await this._init()
    const resp = []
    authorStore.forEach((val) => {
      resp.push(val)
    })
    return resp
  }
  
  async getByName(name){
    await this._init()
    const resp = authorStore.get(name)
    return [resp]
  }
  
  const save(doc){
    const match = authorStore.get(doc.name) || {}
    authorStore.set(doc.name, {...doc, ...match})
  }
  
  async fetch (link){
    const data = await axios.get(`${ENDPOINT}${link}`).then(r => r.data)
    const $ = cheerio.load(data)
    const birthdate = $('span.author-born-date').text()
    const location = $('span.author-born-location').text()
    const biography = $('div.author-description').text()
    const name = $('div.author-title').text()
    const raw = {name, birthdate, location, biography}
    this.save(raw)
  }
}

const createService = () => {
  const app = express();
  const quotes = new Quotes()
  
  // Get Quotes route
  app.get('/quotes', async (req, res)=> {
    const resp = { data: []}
    const requestType = Object.keys(req.query)
    const factory = {
       author: quotes.getByAuthor,
       tag: quotes.getByTag
    }
    // test if query params are set
    if(requestType.length === 0){
      resp.data = await quotes.getAll()
    } else {
      const q = req.query[requestType[0]]
      resp.data = await factory[requestType[0]](q)
    }
    
    return res.json(resp)
  })
  
  const authors= new Authors()
  
  // TODO: Get Authors route
  app.get('/authors', async (req, res)=> {
    const resp = { data: []}
    const isNotQuerable = Object.keys(req.query) === 0
    if(isNotQuerable){
      resp.data = await authors.getAll()
    } else {
      const q = req.query?.name
      // early throw ?
      resp.data = await authors.getByName(q)
    }
    return res.json(resp) 
  })

  return app;
};

module.exports = { createService }; 