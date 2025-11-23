export interface RegionNode {
  code: string
  name: string
  children?: RegionNode[]
}

export interface ProvinceItem {
  code: string
  name: string
}

export interface CityItem {
  code: string
  name: string
  provinceCode: string
}

export interface AreaItem {
  code: string
  name: string
  cityCode: string
  provinceCode: string
}

export interface ParseOptions {
  type?: 0 | 1
  extraGovData?: {
    province?: ProvinceItem[]
    city?: CityItem[]
    area?: AreaItem[]
  }
  textFilter?: string[]
  nameMaxLength?: number
  debug?: boolean
}

export interface ParseResult {
  phone: string
  postalCode: string
  province: string
  city: string
  area: string
  detail: string
  name: string
  provinceCode: string
  cityCode: string
  areaCode: string
}

export interface ParseState {
  phone: string
  postalCode: string
  province: ProvinceItem[]
  city: CityItem[]
  area: AreaItem[]
  detail: string[]
  name: string
  provinceCode: string
  cityCode: string
  areaCode: string
}
