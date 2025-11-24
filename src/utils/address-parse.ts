import zhCnNames from '@/utils/names.json'
import addressJson from '@/utils/pca-code.json'
import filterText from '@/utils/filterText.json'
import type {
  AreaItem,
  CityItem,
  ParseOptions,
  ParseResult,
  ParseState,
  ProvinceItem,
  RegionNode,
} from '@/utils/type'

// ==================== 数据预处理 ====================

// 过滤行政区划
const filterCity = ['行政区划']
;(addressJson as RegionNode[]).forEach((item) => {
  if (item.children) {
    item.children.forEach((city, cityIndex) => {
      const index = ~filterCity.findIndex((filter) => ~city.name.indexOf(filter))
      if (index && item.children && city.children) {
        item.children = [...item.children, ...city.children] as RegionNode[]
        item.children.splice(cityIndex, 1)
      }
    })
  }
})

// 预处理数据
let provinces = addressJson.reduce<ProvinceItem[]>((per, cur) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { children, ...others } = cur
  return per.concat(others)
}, [])

let cities = addressJson.reduce<CityItem[]>((per, cur) => {
  return per.concat(
    cur.children
      ? cur.children.map((city) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { children, ...others } = city
          return {
            ...others,
            provinceCode: cur.code,
          }
        })
      : [],
  )
}, [])

let areas = addressJson.reduce<AreaItem[]>((per, cur) => {
  const provinceCode = cur.code
  return per.concat(
    cur.children
      ? cur.children.reduce<AreaItem[]>((p, c) => {
          const cityCode = c.code
          return p.concat(
            c.children
              ? c.children.map((area) => {
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  const { children, ...others } = area as RegionNode
                  return {
                    ...others,
                    cityCode,
                    provinceCode,
                  }
                })
              : [],
          )
        }, [])
      : [],
  )
}, [])

// 转换为 JSON 字符串用于正则匹配（这是原版的核心优化！）
let provinceString = JSON.stringify(provinces)
let cityString = JSON.stringify(cities)
let areaString = JSON.stringify(areas)

// ==================== 工具函数 ====================

/**
 * 设置额外的国家地理信息
 */
const setExtraGovData = (extraGovData: ParseOptions['extraGovData']): void => {
  const { province, city, area } = extraGovData || {}
  if (province) {
    provinces = provinces.concat(province)
    provinceString = JSON.stringify(provinces)
  }

  if (city) {
    cities = cities.concat(city)
    cityString = JSON.stringify(cities)
  }

  if (area) {
    areas = areas.concat(area)
    areaString = JSON.stringify(areas)
  }
}

/**
 * 按照省市区县镇排序
 */
const sortAddress = (splitAddress: string[]): string[] => {
  const result: string[] = []
  const getIndex = (str: string): number => {
    return splitAddress.findIndex((item) => ~item.indexOf(str))
  }
  ;['省', '市', '区', '县', '镇'].forEach((item) => {
    const index = getIndex(item)
    if (~index) {
      const spliced = splitAddress.splice(index, 1)[0]
      if (spliced) {
        result.push(spliced)
      }
    }
  })
  return [...result, ...splitAddress]
}

// ==================== 地址清洗 ====================

/**
 * 地址清洗
 */
const cleanAddress = (address: string, textFilter: string[] = []): string => {
  // 合并过滤词，并按长度从长到短排序（重要！）
  const allFilters = [...textFilter, ...filterText]
    .filter((item) => item.trim()) // 过滤空值
    .sort((a, b) => b.length - a.length) // 长关键词优先

  let cleaned = address.replace(/\r\n/g, ' ').replace(/\n/g, ' ').replace(/\t/g, ' ')

  // 先处理特殊符号
  const pattern = /[`~!@#$^&*()=|{}':;,\[\].<>\/?！￥…（）—【】；：。，、？]/g
  cleaned = cleaned.replace(pattern, ' ')

  // 按长度从长到短替换关键词（避免部分匹配问题）
  allFilters.forEach((str) => {
    cleaned = cleaned.replace(new RegExp(str, 'g'), ' ')
  })

  // 适配直辖市区
  const municipality = ['北京', '上海', '天津', '重庆']
  municipality.forEach((str) => {
    // 修复直辖市重复问题
    const regex = new RegExp(`(${str})\\s*\\1`, 'g')
    cleaned = cleaned.replace(regex, '$1')
  })

  // 多个空格替换为一个
  cleaned = cleaned.replace(/ {2,}/g, ' ')

  return cleaned.trim()
}

// ==================== 电话和邮编提取 ====================

/**
 * 匹配电话
 */
/**
 * 匹配电话号码（支持手机号、固话、400电话等）
 */
const filterPhone = (address: string): { address: string; phone: string } => {
  let cleaned = address

  // 中国电话号码正则模式
  const phonePatterns = [
    // 手机号：11位，以13-9开头
    /(?:0|\+?86-?|17951)?1[3-9]\d{9}(?:-\d{1,4})?/g,

    // 固话：区号(3-4位)-号码(7-8位)，支持括号和分隔符
    /(?:0\d{2,3}[-\s]?)?\d{7,8}(?:-\d{1,6})?/g,

    // 400/800电话
    /[48]00[-\s]?\d{3}[-\s]?\d{4}(?:-\d{1,4})?/g,

    // 95/96开头的特服号码
    /(?:95|96)\d{3,6}(?:-\d{1,4})?/g,

    // 带国际区号：+86 或 0086 开头
    /(?:\+?86|0086)[-\s]?1[3-9]\d{9}/g,
    /(?:\+?86|0086)[-\s]?0\d{2,3}[-\s]?\d{7,8}/g,
  ]

  // 统一清理电话号码格式
  const normalizePhone = (phoneStr: string): string => {
    return phoneStr
      .replace(/[-\s+()（）]/g, '')
      .replace(/^0086/, '86')
      .replace(/^86(\d{11})/, '$1')
      .replace(/^860?(\d{10,11})/, '$1')
  }

  // 查找所有可能的电话号码
  const phoneMatches: Array<{ match: string; index: number }> = []

  phonePatterns.forEach((pattern) => {
    const matches = cleaned.matchAll(pattern)
    for (const match of matches) {
      if (match.index !== undefined && match[0]) {
        phoneMatches.push({
          match: match[0],
          index: match.index,
        })
      }
    }
  })

  // 如果没有匹配，直接返回
  if (phoneMatches.length === 0) {
    return {
      address: cleaned.replace(/\s+/g, ' ').trim(),
      phone: '',
    }
  }

  // 按匹配位置排序（从右到左）
  phoneMatches.sort((a, b) => b.index - a.index)

  // 安全获取最佳匹配
  const bestMatch = phoneMatches[0]

  // 安全检查
  if (!bestMatch || !bestMatch.match) {
    return {
      address: cleaned.replace(/\s+/g, ' ').trim(),
      phone: '',
    }
  }

  const phone = bestMatch.match

  // 从地址中移除匹配到的电话号码
  cleaned =
    cleaned.substring(0, bestMatch.index) + cleaned.substring(bestMatch.index + phone.length)

  // 格式化返回的电话号码
  const formattedPhone = normalizePhone(phone)

  return {
    address: cleaned.replace(/\s+/g, ' ').trim(),
    phone: formattedPhone,
  }
}

/**
 * 匹配邮编
 */
const filterPostalCode = (address: string): { address: string; postalCode: string } => {
  const postalCodeReg = /\b(\d{6})\b/g

  try {
    const matches = [...address.matchAll(postalCodeReg)]

    // 使用可选链操作符和空值合并进行安全访问
    const lastMatch = matches[matches.length - 1]
    const postalCodeMatch = lastMatch?.[1] ?? ''
    const matchIndex = lastMatch?.index ?? -1
    const matchLength = lastMatch?.[0]?.length ?? 0

    if (postalCodeMatch && matchIndex >= 0) {
      const cleanedAddress =
        address.substring(0, matchIndex) + address.substring(matchIndex + matchLength)

      return {
        address: cleanedAddress.replace(/\s+/g, ' ').trim(),
        postalCode: postalCodeMatch,
      }
    }
  } catch (error) {
    // 如果 matchAll 失败，回退到原始地址
    console.warn('Postal code matching failed:', error)
  }

  return {
    address: address.replace(/\s+/g, ' ').trim(),
    postalCode: '',
  }
}

// ==================== 区域匹配 ====================

/**
 * 利用正则表达式解析（严格按照原版逻辑）
 */
const parseRegionWithRegexp = (
  fragment: string,
  hasParseResult: ParseState,
  log: (...args: string[]) => void,
): { province: ProvinceItem[]; city: CityItem[]; area: AreaItem[]; detail: string[] } => {
  log('----- 当前使用正则匹配模式 -----')
  let province = hasParseResult.province || []
  let city = hasParseResult.city || []
  let area = hasParseResult.area || []
  const detail: string[] = []

  let matchStr = ''
  if (province.length === 0) {
    for (let i = 1; i < fragment.length; i++) {
      const str = fragment.substring(0, i + 1)
      const regexProvince = new RegExp(
        `\\{\"code\":\"[0-9]{1,6}\",\"name\":\"${str}[\\u4E00-\\u9FA5]*?\"}`,
        'g',
      )
      const matchProvince = provinceString.match(regexProvince)
      if (matchProvince) {
        const provinceObj = JSON.parse(matchProvince[0])
        if (matchProvince.length === 1) {
          province = []
          matchStr = str
          province.push(provinceObj)
        }
      } else {
        break
      }
    }

    if (province[0]) {
      fragment = fragment.replace(new RegExp(matchStr, 'g'), '')
    }
  }

  if (city.length === 0) {
    for (let i = 1; i < fragment.length; i++) {
      const str = fragment.substring(0, i + 1)
      const regexCity = new RegExp(
        `\\{\"code\":\"[0-9]{1,6}\",\"name\":\"${str}[\\u4E00-\\u9FA5]*?\",\"provinceCode\":\"${province[0] ? province[0].code : '[0-9]{1,6}'}\"}`,
        'g',
      )
      const matchCity = cityString.match(regexCity)
      if (matchCity) {
        const cityObj = JSON.parse(matchCity[0])
        if (matchCity.length === 1) {
          city = []
          matchStr = str
          city.push(cityObj)
        }
      } else {
        break
      }
    }
    if (city[0]) {
      const { provinceCode } = city[0]
      fragment = fragment.replace(new RegExp(matchStr, 'g'), '')
      if (province.length === 0) {
        const regexProvince = new RegExp(
          `\\{\"code\":\"${provinceCode}\",\"name\":\"[\\u4E00-\\u9FA5]+?\"}`,
          'g',
        )
        const matchProvince = provinceString.match(regexProvince)
        if (matchProvince) {
          province.push(JSON.parse(matchProvince[0]))
        }
      }
    }
  }

  if (area.length === 0) {
    for (let i = 1; i < fragment.length; i++) {
      const str = fragment.substring(0, i + 1)
      const regexArea = new RegExp(
        `\\{\"code\":\"[0-9]{1,9}\",\"name\":\"${str}[\\u4E00-\\u9FA5]*?\",\"cityCode\":\"${city[0] ? city[0].code : '[0-9]{1,6}'}\",\"provinceCode\":\"${province[0] ? province[0].code : '[0-9]{1,6}'}\"}`,
        'g',
      )
      const matchArea = areaString.match(regexArea)
      if (matchArea) {
        const areaObj = JSON.parse(matchArea[0])
        if (matchArea.length === 1) {
          area = []
          matchStr = str
          area.push(areaObj)
        }
      } else {
        break
      }
    }
    if (area[0]) {
      const { provinceCode, cityCode } = area[0]
      fragment = fragment.replace(matchStr, '')
      if (province.length === 0) {
        const regexProvince = new RegExp(
          `\\{\"code\":\"${provinceCode}\",\"name\":\"[\\u4E00-\\u9FA5]+?\"}`,
          'g',
        )
        const matchProvince = provinceString.match(regexProvince)
        if (matchProvince) {
          province.push(JSON.parse(matchProvince[0]))
        }
      }
      if (city.length === 0) {
        const regexCity = new RegExp(
          `\\{\"code\":\"${cityCode}\",\"name\":\"[\\u4E00-\\u9FA5]+?\",\"provinceCode\":\"${provinceCode}\"}`,
          'g',
        )
        const matchCity = cityString.match(regexCity)
        if (matchCity) {
          city.push(JSON.parse(matchCity[0]))
        }
      }
    }
  }

  // 解析完省市区如果还存在地址，则默认为详细地址
  if (fragment.length > 0) {
    detail.push(fragment)
  }

  return {
    province,
    city,
    area,
    detail,
  }
}

/**
 * 利用树向下查找解析（严格按照原版逻辑）
 */
const parseRegion = (
  fragment: string,
  hasParseResult: ParseState,
  log: (...args: string[]) => void,
): { province: ProvinceItem[]; city: CityItem[]; area: AreaItem[]; detail: string[] } => {
  log('----- 当前使用树查找模式 -----')
  let province: ProvinceItem[] = []
  let city: CityItem[] = []
  const area: AreaItem[] = []
  const detail: string[] = []

  if (hasParseResult.province[0]) {
    province = hasParseResult.province
  } else {
    // 从省开始查找
    for (const tempProvince of provinces) {
      const { name } = tempProvince
      let replaceName = ''
      for (let i = name.length; i > 1; i--) {
        const temp = name.substring(0, i)
        if (fragment.indexOf(temp) === 0) {
          replaceName = temp
          break
        }
      }
      if (replaceName) {
        province.push(tempProvince)
        fragment = fragment.replace(new RegExp(replaceName, 'g'), '')
        break
      }
    }
  }

  if (hasParseResult.city[0]) {
    city = hasParseResult.city
  } else {
    // 从市区开始查找
    for (const tempCity of cities) {
      const { name, provinceCode } = tempCity
      const currentProvince = province[0]
      // 有省
      if (currentProvince) {
        if (currentProvince.code === provinceCode) {
          let replaceName = ''
          for (let i = name.length; i > 1; i--) {
            const temp = name.substring(0, i)
            if (fragment.indexOf(temp) === 0) {
              replaceName = temp
              break
            }
          }
          if (replaceName) {
            city.push(tempCity)
            fragment = fragment.replace(new RegExp(replaceName, 'g'), '')
            break
          }
        }
      } else {
        // 没有省，市不可能重名
        for (let i = name.length; i > 1; i--) {
          const replaceName = name.substring(0, i)
          if (fragment.indexOf(replaceName) === 0) {
            city.push(tempCity)
            const foundProvince = provinces.find((item) => item.code === provinceCode)
            if (foundProvince) {
              province.push(foundProvince)
            }
            fragment = fragment.replace(replaceName, '')
            break
          }
        }
        if (city.length > 0) {
          break
        }
      }
    }
  }

  // 从区市县开始查找
  for (const tempArea of areas) {
    const { name, provinceCode, cityCode } = tempArea
    const currentProvince = province[0]
    const currentCity = city[0]

    // 有省或者市
    if (currentProvince || currentCity) {
      if (
        (currentProvince && currentProvince.code === provinceCode) ||
        (currentCity && currentCity.code === cityCode)
      ) {
        let replaceName = ''
        for (let i = name.length; i > 1; i--) {
          const temp = name.substring(0, i)
          if (fragment.indexOf(temp) === 0) {
            replaceName = temp
            break
          }
        }
        if (replaceName) {
          area.push(tempArea)
          if (!currentCity) {
            const foundCity = cities.find((item) => item.code === cityCode)
            if (foundCity) {
              city.push(foundCity)
            }
          }
          if (!currentProvince) {
            const foundProvince = provinces.find((item) => item.code === provinceCode)
            if (foundProvince) {
              province.push(foundProvince)
            }
          }
          fragment = fragment.replace(replaceName, '')
          break
        }
      }
    } else {
      // 没有省市，区县市有可能重名，这里暂时不处理，因为概率极低，可以根据添加市解决
      for (let i = name.length; i > 1; i--) {
        const replaceName = name.substring(0, i)
        if (fragment.indexOf(replaceName) === 0) {
          area.push(tempArea)
          const foundCity = cities.find((item) => item.code === cityCode)
          if (foundCity) {
            city.push(foundCity)
          }
          const foundProvince = provinces.find((item) => item.code === provinceCode)
          if (foundProvince) {
            province.push(foundProvince)
          }
          fragment = fragment.replace(replaceName, '')
          break
        }
      }
      if (area.length > 0) {
        break
      }
    }
  }

  // 解析完省市区如果还存在地址，则默认为详细地址
  if (fragment.length > 0) {
    detail.push(fragment)
  }

  return {
    province,
    city,
    area,
    detail,
  }
}

// ==================== 姓名识别 ====================

/**
 * 判断是否是名字
 */
const judgeFragmentIsName = (fragment: string, nameMaxLength: number): string => {
  if (!fragment || !/[\u4E00-\u9FA5]/.test(fragment)) {
    return ''
  }

  // 如果包含下列称呼，则认为是名字，可自行添加
  const nameCall = [
    '先生',
    '小姐',
    '同志',
    '哥哥',
    '姐姐',
    '妹妹',
    '弟弟',
    '妈妈',
    '爸爸',
    '爷爷',
    '奶奶',
    '姑姑',
    '舅舅',
    '老公',
    '老婆',
    '媳妇',
  ]
  if (nameCall.find((item) => ~fragment.indexOf(item))) {
    return fragment
  }

  const filters = ['街道', '乡镇', '镇', '乡']
  if (~filters.findIndex((item) => ~fragment.indexOf(item))) {
    return ''
  }

  // 如果百家姓里面能找到这个姓，并且长度在1-5之间
  const nameFirst = fragment.substring(0, 1)
  if (fragment.length <= nameMaxLength && fragment.length > 1 && ~zhCnNames.indexOf(nameFirst)) {
    return fragment
  }

  return ''
}

// ==================== 主解析函数 ====================

/**
 * 地址解析函数
 */
const AddressParse = (address: string, options?: ParseOptions | number): ParseResult => {
  const opts: ParseOptions =
    typeof options === 'object'
      ? options
      : typeof options === 'number'
        ? { type: options as 0 | 1 }
        : {}

  const { type = 0, extraGovData = {}, textFilter = [], nameMaxLength = 4, debug = false } = opts

  const log = (...infos: unknown[]): void => {
    if (debug) {
      console.log(...infos)
    }
  }

  if (!address) {
    return {
      phone: '',
      postalCode: '',
      province: '',
      city: '',
      area: '',
      detail: '',
      name: '',
      provinceCode: '',
      cityCode: '',
      areaCode: '',
    }
  }

  setExtraGovData(extraGovData)

  const parseResult: ParseState = {
    phone: '',
    postalCode: '',
    province: [],
    city: [],
    area: [],
    detail: [],
    name: '',
    provinceCode: '',
    cityCode: '',
    areaCode: '',
  }

  let cleanedAddress = cleanAddress(address, textFilter)
  log('清洗后address --->', cleanedAddress)

  // 识别手机号
  const resultPhone = filterPhone(cleanedAddress)
  cleanedAddress = resultPhone.address
  parseResult.phone = resultPhone.phone
  log('获取电话的结果 --->', cleanedAddress)

  const resultCode = filterPostalCode(cleanedAddress)
  cleanedAddress = resultCode.address
  parseResult.postalCode = resultCode.postalCode
  log('获取邮编的结果 --->', cleanedAddress)

  // 地址分割，排序
  let splitAddress = cleanedAddress
    .split(' ')
    .filter((item) => item && !/^\d+$/.test(item))
    .map((item) => item.trim())
  splitAddress = sortAddress(splitAddress)
  log('分割地址 --->', splitAddress)

  const d1 = new Date().getTime()

  // 找省市区和详细地址
  splitAddress.forEach((item) => {
    // 识别地址
    if (!parseResult.province[0] || !parseResult.city[0] || !parseResult.area[0]) {
      // 两个方法都可以解析，正则和树查找
      let parse: ReturnType<typeof parseRegion>
      if (type === 1) {
        parse = parseRegion(item, parseResult, log)
      } else {
        parse = parseRegionWithRegexp(item, parseResult, log)
      }
      const { province, city, area, detail } = parse
      parseResult.province = province || []
      parseResult.area = area || []
      parseResult.city = city || []
      parseResult.detail = parseResult.detail.concat(detail || [])
      parseResult.areaCode = parseResult.area[0]?.code || ''
      parseResult.provinceCode = parseResult.province[0]?.code || ''
      parseResult.cityCode = parseResult.city[0]?.code || ''
    } else {
      parseResult.detail.push(item)
    }
  })

  log('--->', splitAddress)

  const d2 = new Date().getTime()
  log('解析耗时--->', d2 - d1)

  const province = parseResult.province[0]
  const city = parseResult.city[0]
  const area = parseResult.area[0]
  let detail = parseResult.detail

  detail = detail.map((item) =>
    item.replace(
      new RegExp(`${province && province.name}|${city && city.name}|${area && area.name}`, 'g'),
      '',
    ),
  )
  detail = Array.from(new Set(detail))
  log('去重后--->', detail)

  // 地址都解析完了，姓名应该是在详细地址里面
  if (detail && detail.length > 0) {
    const copyDetail = [...detail].filter((item) => !!item)
    copyDetail.sort((a, b) => a.length - b.length)
    log('copyDetail --->', copyDetail)
    // 排序后从最短的开始找名字，没找到的话就看第一个是不是咯
    const index = copyDetail.findIndex((item) => judgeFragmentIsName(item, nameMaxLength))
    let name = ''
    if (~index && copyDetail[index]) {
      name = copyDetail[index]
    } else if (
      copyDetail[0] &&
      copyDetail[0].length <= nameMaxLength &&
      /[\u4E00-\u9FA5]/.test(copyDetail[0])
    ) {
      name = copyDetail[0]
    }

    // 找到了名字就从详细地址里面删除它
    if (name) {
      parseResult.name = name
      const nameIndex = detail.findIndex((item) => item === name)
      if (nameIndex >= 0) {
        detail.splice(nameIndex, 1)
      }
    }
  }

  log(JSON.stringify(parseResult))

  const provinceName = province && province.name
  let cityName = city && city.name
  const areaName = area && area.name

  // If an area is parsed, trust its parent city from data source.
  if (area) {
    const parentCity = cities.find((c) => c.code === area.cityCode)
    if (parentCity) {
      cityName = parentCity.name
    }
  }

  if (cityName && ~['区', '县', '镇'].indexOf(cityName)) {
    cityName = provinceName
  }

  return Object.assign(parseResult, {
    province: provinceName || '',
    city: cityName || '',
    area: areaName || '',
    detail: detail && detail.length > 0 ? detail.join('') : '',
    postalCode: parseResult.postalCode,
  })
}

// ==================== 主导出函数 ====================

/**
 * 地址解析 Hook
 */
export function useAddressParse(options: ParseOptions = {}) {
  /**
   * 解析地址
   */
  const parse = (address: string, parseOptions?: ParseOptions | number): ParseResult => {
    const mergedOptions: ParseOptions =
      typeof parseOptions === 'object'
        ? { ...options, ...parseOptions }
        : typeof parseOptions === 'number'
          ? { ...options, type: parseOptions as 0 | 1 }
          : options
    return AddressParse(address, mergedOptions)
  }

  return {
    parse,
  }
}
