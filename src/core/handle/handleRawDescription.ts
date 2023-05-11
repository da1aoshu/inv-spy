export function handleRawDescription(descriptions: any[]): [Map<string, any>, Map<string, any>, number] {
    let units = new Map<string, any>();
    let items = new Map<string, any>();

    let units_count = 0;
    descriptions?.forEach((item: any) => {
        let {
            classid, // 类id
            tradable, // 是否可第三方交易
            commodity, // CSGO商店是否售卖
            instanceid, // 继承类id的实例id
            marketable, // 市场上是否可以交易
            market_name, // 物品名称
            market_hash_name, // 物品唯一标识
            descriptions = [], // 物品详细描述
            fraudwarnings = [], // 物品改名标签
        } = item;

        let value: any = {
            classid,
            tradable,
            commodity,
            instanceid,
            marketable,
            market_name,
            market_hash_name
        };

        // value中加入标签名称
        if(fraudwarnings.length) value['fraudwarnings'] = fraudwarnings[0].slice(6, -1);

        // 市场上不可以交易
        if(!marketable) {
            // 不为组件则不计入物品
            if(!commodity || market_hash_name !== 'Storage Unit') return;

            value['unitinfo'] = { };
            value['unitinfo'].count = 0;
            value['unitinfo'].timestamp = 0;

            if(
                descriptions[2] &&
                descriptions[3] &&
                descriptions[2]?.value.includes("物品数量") &&
                descriptions[3]?.value.includes("修改日期")
            ) {
                let temps: any = descriptions[3]?.value.slice(0,-9).split(' ') || ['', '', '', ''];

                value['unitinfo'].count = parseInt(descriptions[2]?.value.split(':')[1]);
                value['unitinfo'].timestamp = new Date(
                    `${temps[1]}-${parseInt(temps[2])}-${temps[3]} ${temps[4].slice(1, -1)}`
                ).getTime() + 8 * 60 * 60 * 1000;

                units_count += value['unitinfo'].count;
            }

            return units.set(`${classid}_${instanceid}`, value);
        }

        // if(
        //     !tradable &&
        //     owner_descriptions.length &&
        //     owner_descriptions[1].value.includes("后可交易")
        // ) {
        //     // 获取可交易时间
        //     let temp = owner_descriptions[1].value;
        //     let temps = temp.slice(0,-5).split(' ');
        //     let template = `${temps[0]}-${parseInt(temps[1])}-${temps[2]} 15:00:00`;
        //
        //     value['tradetime'] = new Date(template).getTime();
        // }

        items.set(`${classid}_${instanceid}`, value);
    })

    return [items, units, units_count];
}