const express = require('express')
const request = require('request')
const cheerio = require('cheerio')
const fs = require('fs')
const app = express()

const util = require('util')

app.listen(process.env.PORT || 5000, function () {
  console.log('Start listening...')
})

//const TOKEN = process.env.TELEGRAM_TOKEN || '404227050:AAFSO2JQfyFIf5szXgZ-7JhJu70nfJ8fDBw' // demo
const TOKEN = process.env.TELEGRAM_TOKEN || '389024887:AAHSBw31_HtMK5hlz_iajq4TYqZFwE-3rlA'
const TelegramBot = require('node-telegram-bot-api')
const options = {
  polling: true
}; 
const bot = new TelegramBot(TOKEN, options);

bot.onText(/\/start/, msg => {
  chatId = msg.chat.id
  addUser(chatId)

  chat_id_single = chatId
  update()

  bot.sendMessage(msg.chat.id, 'Привет! Вот список сериалов на сегодня:')
})

const url = 'https://www.film.ru/serials/soon'
const userPath = 'public/files/data.json'
const infosPath = 'public/files/infos.json'
let chat_id_single = 0

const schedule = require('node-schedule')
schedule.scheduleJob({ hour: 3, minute: 0 }, update)

function update() {
  updateData(infos => {
    if (chat_id_single === 0) {
      let data = getUsers()
      data.forEach(e => {
        sendReply(infos, e.chat_id)
      })
    } else {
      sendReply(infos, chat_id_single)
      chat_id_single = 0
    }
  })
}

function sendReply(infos, chat_id) {
  infos.forEach((e, i) => {
    bot.sendMessage(chat_id, e.upd, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: 'Подбробнее',
              callback_data: util.format('%j', { index: i.toString(), opened: false })
            }
          ]
        ]
      },
      'parse_mode': 'HTML'
    })
  })
}

function updateData(callback) {
  request(url, (error, response, html) => {
    let str = ''
    let index = 0

    infos = [{ upd: '', desc: '', href: '' }]

    if (!error && response.statusCode === 200) {
      const $ = cheerio.load(html)

      $('div.b-n a').not((i, e) => {
        return e.attribs.href.includes('articles')
      }).each((i, e) => {
        if (i > 2) {
          if (e.parentNode.parentNode.parentNode.previousSibling.attribs.class === 'b-d mt30')
            return false
          if (e.attribs.class !== 'gray') {
            index++
            infos.push({ upd: '', desc: '' })
          }
        }

        if (e.parentNode.name === 'h3')
          infos[index].href = 'https://www.film.ru' + e.attribs.href

        infos[index].upd += '\n' + ((i % 3 === 0) ? '<b>' : '') + e.children[0].data.trim() + ((i % 3 === 0) ? '</b>' : '')
      })
    }

    infos.forEach((e, i) => {
      request(e.href, (error, response, html) => {
        const $ = cheerio.load(html)

        infos[i].desc += $('div.ntext').contents().text()

        fs.writeFile(infosPath, JSON.stringify(infos), err => {
          if (err) {
            return console.log(err)
          }
        })
      })
    })

    callback(infos)
  })
}

bot.on('callback_query', function onCallbackQuery(callbackQuery) {
  const callbackJSON = JSON.parse(callbackQuery.data)
  const action = callbackJSON.index
  const isOpen = callbackJSON.opened
  const msg = callbackQuery.message
  const opts = {
    chat_id: msg.chat.id,
    message_id: msg.message_id,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: 'Подбробнее',
            callback_data: util.format('%j', { index: action, opened: !isOpen })
          }
        ]
      ]
    },
    'parse_mode': 'HTML'
  }

  let infos = JSON.parse(fs.readFileSync(infosPath))

  let newText = infos[action].upd

  if (!isOpen)
    newText += '\n\n' + (infos[action].desc === '' ? 'Хороший сериал, наверное...' : infos[action].desc)

  bot.editMessageText(newText, opts)
})

function addUser(chat_id) {
  let data
  let newChat = { chat_id: chat_id }
  if (fs.existsSync(userPath)) {
    data = JSON.parse(fs.readFileSync(userPath))

    if (data.filter(e => e.chat_id === chat_id).length === 0)
      data.push(newChat)

    console.log('current users: ', data)
  } else {
    data = [newChat]
  }

  fs.writeFile(userPath, JSON.stringify(data), err => {
    if (err) {
      return console.log(err)
    }
  });

  return data
}

function getUsers() {
  let data = {}
  if (fs.existsSync(userPath))
    data = JSON.parse(fs.readFileSync(userPath))
  return data
}