<script setup lang="ts">
import { ref } from 'vue'
import { useAddressParse } from '@/utils/address-parse'
import type { ParseResult } from '@/utils/type'

// 使用地址解析函数，可以传入配置选项
const { parse } = useAddressParse({
  type: 0, // 0: 正则匹配, 1: 树查找
  nameMaxLength: 4, // 姓名最大长度
  debug: true, // 是否开启调试模式
  // textFilter: ['自定义过滤词'], // 自定义过滤文本
})

// 地址输入
const address = ref(`收件人: 靳策
手机号码: 18888888888
邮编: 075700
所在地区: 河北省张家口市，蔚县南留庄镇`)

// 解析结果
const parseResult = ref<ParseResult | null>(null)

// 解析类型选择
const parseType = ref<0 | 1>(1)

// 解析处理函数
const parseHandler = () => {
  const result = parse(address.value, {
    type: parseType.value,
    debug: true,
  })
  parseResult.value = result
  console.log('解析结果:', result)
}

// 示例地址
const exampleAddresses = [
  {
    label: '示例1: 标准地址',
    value: `收件人: 张三
手机号码: 13812345678
邮编: 400000
所在地区: 重庆市 重庆市 巴南区南泉街道华林路融创欧麓花园城博琅郡2期北2栋`,
  },
  {
    label: '示例2: 直辖市地址',
    value: `收件人: 李四
电话: 13987654321
地址: 北京市 北京市 朝阳区建国门外大街1号国贸大厦`,
  },
  {
    label: '示例3: 带称呼地址',
    value: `收货人: 王五先生
联系电话: 13711112222
详细地址: 上海市 上海市 浦东新区陆家嘴环路1000号`,
  },
  {
    label: '示例4: 简化地址',
    value: `姓名: 赵六
手机: 13633334444
地址: 广东省深圳市南山区科技园`,
  },
]

// 选择示例地址
const selectExample = (example: { value: string }) => {
  address.value = example.value
  parseHandler()
}
</script>

<template>
  <div class="address-parse-container">
    <h1>地址解析工具</h1>

    <div class="main-content">
      <!-- 左侧：输入区域 -->
      <div class="input-section">
        <div class="section-header">
          <h2>输入地址</h2>
          <div class="options">
            <label>
              <input type="radio" v-model="parseType" :value="0" />
              正则匹配
            </label>
            <label>
              <input type="radio" v-model="parseType" :value="1" />
              树查找
            </label>
          </div>
        </div>

        <textarea v-model="address" placeholder="请输入要解析的地址..." class="address-input" />

        <div class="button-group">
          <button @click="parseHandler" class="parse-btn">解析地址</button>
        </div>

        <!-- 示例地址 -->
        <div class="examples">
          <h3>示例地址：</h3>
          <div class="example-buttons">
            <button
              v-for="(example, index) in exampleAddresses"
              :key="index"
              @click="selectExample(example)"
              class="example-btn"
            >
              {{ example.label }}
            </button>
          </div>
        </div>
      </div>

      <!-- 右侧：结果展示 -->
      <div class="result-section">
        <h2>解析结果</h2>
        <div v-if="parseResult" class="result-content">
          <div class="result-item">
            <span class="label">姓名：</span>
            <span class="value">{{ parseResult.name || '未识别' }}</span>
          </div>
          <div class="result-item">
            <span class="label">手机号：</span>
            <span class="value">{{ parseResult.phone || '未识别' }}</span>
          </div>
          <div class="result-item">
            <span class="label">邮编：</span>
            <span class="value">{{ parseResult.postalCode || '未识别' }}</span>
          </div>
          <div class="result-item">
            <span class="label">省份：</span>
            <span class="value">{{ parseResult.province || '未识别' }}</span>
            <span class="code" v-if="parseResult.provinceCode"
              >({{ parseResult.provinceCode }})</span
            >
          </div>
          <div class="result-item">
            <span class="label">城市：</span>
            <span class="value">{{ parseResult.city || '未识别' }}</span>
            <span class="code" v-if="parseResult.cityCode">({{ parseResult.cityCode }})</span>
          </div>
          <div class="result-item">
            <span class="label">区县：</span>
            <span class="value">{{ parseResult.area || '未识别' }}</span>
            <span class="code" v-if="parseResult.areaCode">({{ parseResult.areaCode }})</span>
          </div>
          <div class="result-item full-width">
            <span class="label">详细地址：</span>
            <span class="value">{{ parseResult.detail || '未识别' }}</span>
          </div>
        </div>
        <div v-else class="no-result">点击"解析地址"按钮查看结果</div>

        <!-- JSON 格式结果 -->
        <div v-if="parseResult" class="json-result">
          <h3>JSON 格式：</h3>
          <pre>{{ JSON.stringify(parseResult, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.address-parse-container {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}

h1 {
  text-align: center;
  color: #333;
  margin-bottom: 30px;
}

.main-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

@media (max-width: 1024px) {
  .main-content {
    grid-template-columns: 1fr;
  }
}

.input-section,
.result-section {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.section-header h2 {
  margin: 0;
  color: #333;
  font-size: 18px;
}

.options {
  display: flex;
  gap: 15px;
}

.options label {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  font-size: 14px;
}

.address-input {
  width: 100%;
  min-height: 200px;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  box-sizing: border-box;
}

.address-input:focus {
  outline: none;
  border-color: #4caf50;
  box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.1);
}

.button-group {
  margin-top: 15px;
}

.parse-btn {
  background: #4caf50;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
  width: 100%;
  transition: background 0.3s;
}

.parse-btn:hover {
  background: #45a049;
}

.parse-btn:active {
  transform: translateY(1px);
}

.examples {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #ddd;
}

.examples h3 {
  margin: 0 0 10px 0;
  font-size: 14px;
  color: #666;
}

.example-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.example-btn {
  background: white;
  border: 1px solid #ddd;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
}

.example-btn:hover {
  background: #e8f5e9;
  border-color: #4caf50;
}

.result-section h2 {
  margin: 0 0 15px 0;
  color: #333;
  font-size: 18px;
}

.result-content {
  background: white;
  border-radius: 4px;
  padding: 15px;
  margin-bottom: 20px;
}

.result-item {
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #eee;
}

.result-item:last-child {
  border-bottom: none;
}

.result-item.full-width {
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
}

.label {
  font-weight: 600;
  color: #666;
  min-width: 80px;
  font-size: 14px;
}

.value {
  color: #333;
  font-size: 14px;
  word-break: break-all;
}

.code {
  color: #999;
  font-size: 12px;
  margin-left: 8px;
}

.no-result {
  text-align: center;
  color: #999;
  padding: 40px;
  font-size: 14px;
}

.json-result {
  background: white;
  border-radius: 4px;
  padding: 15px;
}

.json-result h3 {
  margin: 0 0 10px 0;
  font-size: 14px;
  color: #666;
}

.json-result pre {
  background: #f5f5f5;
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 12px;
  line-height: 1.5;
  margin: 0;
}
</style>
