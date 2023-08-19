const defaultMessage = ' Using Poem of the day instead.'

// copied from Poem name
const answers = [

  "寥落古行宫",
  "宫花寂寞红",
  "白头宫女在",
  "闲坐说玄宗",

  "生当作人杰",
  "死亦为鬼雄",
  "至今思项羽",
  "不肯过江东",

  "迟日江山丽","春风花草香",
  "泥融飞燕子","沙暖睡鸳鸯",
  
  "江碧鸟逾白","山青花欲燃",
  "今春看又过","何日是归年"
  
]

function dayCount(){

  const now = new Date()
  const start = new Date(2022, 0, 0)
  const diff = Number(now) - Number(start)
  let day = Math.floor(diff / (1000 * 60 * 60 * 24))
  while (day > answers.length) {
    day -= answers.length
  }

  console.log(day)
  return day
}

const day = dayCount()

export function getPoemOfTheDay() {
  if (location.search) {
    try {
      const query = atob(location.search.slice(1))
      if (query.length !== 5) {
        alert(`Incorrect word length from encoded query. ${defaultMessage}`)
      } else {
        return query
      }
    } catch (e) {
      alert(`Malformed encoded word query. ${defaultMessage}`)
    }
  }
  console.log(answers[day])
  return answers[day]
}


// generate the 26 keymap for the answer

export function getKeyMapOfTheDay(){
  var keyMap = []
  var line1 = ""
  var line2 = ""
  var line3 = ""
  var numarr: number[] = []
  numarr.push(day)
  var wholeKey = getPoemOfTheDay()
  var answerOfTheDay = getPoemOfTheDay()
  var answerSize=answerOfTheDay.length
  
  //get all the key, mix them, put 989 format into three line variable and output the whole keymap
  while(wholeKey.length<=28){
    var num = Math.floor(Math.random()*10)+1
    if(numarr.indexOf(num)===-1){
      wholeKey+=answers[num]
      numarr.push(num)
    }  
  }
  wholeKey=wholeKey.substring(0,27)

  var wholeKeyarr = wholeKey.split('')
  for (let i = 1; i <wholeKeyarr.length; i++) {
    const random = Math.floor(Math.random() * (i + 1));
    [wholeKeyarr[i], wholeKeyarr[random]] = [wholeKeyarr[random], wholeKeyarr[i]];
}
  wholeKey = wholeKeyarr.toString().replaceAll(',','')

  //after the loop, all the key has been saved into wholeKey
  line1= wholeKey.substring(0,9)
  line2= wholeKey.substring(9,18)
  line3= wholeKey.substring(18,26)
  keyMap.push(line1,line2,line3)
  return keyMap

}



const allowedGuesses = [
 
"寥落古行宫",
  "宫花寂寞红",
  "白头宫女在",
  "闲坐说玄宗",

  "生当作人杰",
  "死亦为鬼雄",
  "至今思项羽",
  "不肯过江东",

  "迟日江山丽","春风花草香",
  "泥融飞燕子","沙暖睡鸳鸯",
  
  "江碧鸟逾白","山青花欲燃",
  "今春看又过","何日是归年"
  
]

const titles = []


export const allWords = [...answers, ...allowedGuesses]

