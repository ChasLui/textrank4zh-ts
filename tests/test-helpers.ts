/**
 * 测试辅助函数
 */

import { TextRankResult } from '../src/types';

/**
 * 断言 Result 为成功状态
 */
export function expectResultOk<T>(result: TextRankResult<T>): asserts result is { ok: true; value: T } {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(`Expected Ok, got Err: ${result.error!.message}`);
  }
}

/**
 * 断言 Result 为失败状态
 */
export function expectResultErr<T>(result: TextRankResult<T>): asserts result is { ok: false; error: any } {
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error('Expected Err, got Ok');
  }
}

/**
 * 安全执行分析并返回结果
 */
export function safeAnalyze<T extends { analyze: (...args: any[]) => TextRankResult<void> }>(
  analyzer: T,
  ...args: Parameters<T['analyze']>
): void {
  const result = analyzer.analyze(...args);
  expectResultOk(result);
}

/**
 * 比较数组是否相等（带容差）
 */
export function arraysEqual(a: any[], b: any[], tolerance: number = 0): boolean {
  if (a.length !== b.length) return false;
  return a.every((val, i) => {
    if (typeof val === 'number' && typeof b[i] === 'number') {
      return Math.abs(val - b[i]) <= tolerance;
    }
    return val === b[i];
  });
}

/**
 * 获取测试文本
 */
export function getTestText(size: 'small' | 'medium' | 'large' = 'medium'): string {
  const small = '北京是中华人民共和国的首都，是全国政治中心、文化中心。';
  
  const medium = `
北京是中华人民共和国的首都，是全国政治中心、文化中心。
上海是中华人民共和国直辖市，是中国最大的经济中心城市。
深圳是中国改革开放的前沿城市，经济发展迅速。
杭州以西湖而闻名，是浙江省的省会城市。
成都是四川省省会，有着悠久的历史文化底蕴。
广州是广东省省会，也是中国重要的对外贸易港口。
`.trim();

  const large = `
北京是中华人民共和国的首都，全国政治中心、文化中心、国际交往中心、科技创新中心。
北京位于华北平原北部，背靠燕山，毗邻天津市和河北省。
北京的气候为典型的北温带半湿润大陆性季风气候，夏季高温多雨，冬季寒冷干燥，春、秋短促。

上海是中华人民共和国直辖市，国家中心城市，超大城市，是中国共产党的诞生地。
上海是中国最大的经济中心城市和重要的国际金融中心、贸易中心、航运中心。
上海位于中国华东地区，界于东经120°52′-122°12′，北纬30°40′-31°53′之间。

深圳是广东省副省级市、计划单列市、超大城市，国务院批复确定的中国经济特区。
深圳是国家经济特区，全国性经济中心城市和国际化城市，也是粤港澳大湾区核心引擎城市之一。
深圳地处中国华南地区、广东南部、珠江口东岸，东临大亚湾和大鹏湾。

杭州，简称"杭"，古称临安、钱塘，是浙江省省会、副省级市、杭州都市圈核心城市。
杭州位于中国华东地区、浙江省北部、钱塘江下游、京杭大运河南端，是环杭州湾大湾区核心城市。
杭州人文古迹众多，西湖及其周边有大量的自然及人文景观遗迹，具有重要的文化遗产价值。

成都，简称"蓉"，别称蓉城、锦城，是四川省省会、副省级市、特大城市、成都都市圈核心城市。
成都位于四川盆地西部，成都平原腹地，境内地势平坦、河网纵横、物产丰富、农业发达。
成都是国家重要的高新技术产业基地、商贸物流中心和综合交通枢纽，西部地区重要的中心城市。

广州，简称"穗"，别称羊城、花城，是广东省省会、副省级市、国家中心城市、超大城市。
广州地处中国南部、广东省中南部、珠江三角洲中北缘，是粤港澳大湾区、泛珠江三角洲经济区的核心城市。
广州是国家重要中心城市、国际商贸中心、国际综合交通枢纽，首批沿海开放城市，是南方丝绸之路的起点之一。
`.trim();

  switch (size) {
    case 'small':
      return small;
    case 'medium':
      return medium;
    case 'large':
      return large;
    default:
      return medium;
  }
}