
import { CSGearSlot, CSPlayerController, CSPlayerPawn, Instance, PointTemplate } from "cs_script/point_script";
/** Author: Theordinary
 * Create Time:2026/1/19
 * 起源2基于JavaScript的boss追踪功能,提供一定程度上的自由配置
 * Version 1.2 Update 2026/2/15
 * 此脚本可供任意地图作者使用
 */

/**
 * 1.2更新内容
 * 添加boss模型的targetname配置
 * 添加boss死亡动画配置选项
 * 添加boss停止追逐的功能
 * 添加boss恢复追逐功能
 * boss现在的移动默认改为关闭,需要通过IO激活(例:Ontrigger script runscriptinput boss_unfreeze 5就是延迟5秒后启用追逐)
 * 移除了部分调试信息,不会再打印到聊天框
 * 优化了配置列表,部分繁琐变量移动到函数内部
 * ps:boss_template.vmap同步更新,有疑问同样可以参考
 * 有新的问题还麻烦大伙反馈一下
 */

//服务器配置
const Server_tickrate = 64;
const Server_tickInterval = 1 / Server_tickrate;

//脚本常规配置
const boss_track_team = 3;//boss锁定玩家阵营,3为ct,2为t
const boss_hp_add = 200;//boss动态血量,乘以人数后累加至血量中
const boss_template_targetname = "boss_template";//boss模板实体targetname配置
const boss_position_targetname = "boss_spawn_point";//boss生成位置targetname配置
const boss_phys_targetname = "boss_physbox";//boss物理碰撞实体的targetname配置
const boss_hpbar_targetname = "boss_hp_text";//boss血条实体的targetname配置
const boss_model_targetname = "boss_model";//boss模型的targetname配置
const boss_track_traget_boolean = true;//boss锁定目标显示开关,若不需要改为false
const boss_death_animation_boolean = false;//boss是否启用死亡动画,若启用则需要配置下方动画输出
const boss_death_animation = "";//boss死亡动画名称,对应模型编辑器内的动作名字,未启用死亡动画则不用管
const boss_death_animation_delay = 0;//boss死亡动画播放延迟,未启用死亡动画则不用管
const config = {
    acceleration: 200,//加速度
    maxspeed: 400,//最大速度
    health: 5000,//初始血量
    position: null,
    template: null,
    rotabase: 0.4,//转向速度
    hatred: 6,//仇恨时间,自动更换目标所需的时间
    Buffer: 150//boss靠近减速距离
};//boss配置

/*
脚本配置及使用说明
完成以下实体创建
1、point_template(命名为boss_template,若想修改为自定义名称,请修改上述参数中的boss_template=Instance.FindEntityByName("XXXXXX"),将括号内的名称替换即可)
2、info_target(命名为boss_spawn_point,若想修改为自定义名称,请修改上述参数中的boss_position=Instance.FindEntityByName("XXXXXX").GetAbsOrigin(),将括号内的名称替换即可)
3、func_phys_box(创建物理碰撞实体,命名为boss_physbox,与配置中boss_phys_targetname相同,若想自定义名称,像1、2步操作即可)将该实体存入之前创建的point_template中,并为该实体添加ondamaged对脚本实体输入runscriptinput,参数boss_hp_subract(用于boss减血)
4、prop_dynamic(创建boss模型,命名为boss_model,与配置中boss_phys_targetname相同,若想自定义名称,像1、2步操作即可)
4、point_worldtext(创建文本实体,命名为boss_hp_text,与配置中boss_hpbar_targetname相同,若想自定义名称,像1、2步操作即可)将该实体存入之前创建的point_template中
5、配置config参数,(已有默认参数,可按需调整)
6、将此脚本放置在csgo_addons/你的创意工坊项目文件夹/scripts/vscripts下(没有文件夹,只需创建同名文件夹即可)
7、创建point_script实体(任意命名),,并在属性内的script选择该脚本路径
8、创建任意触发类实体,对point_script这个实体输入runscriptinput参数填script_init,触发后即可生成boss
9、若对上述说明存有疑问,请参考示例地图boss_template.vmap中的实体放置
*/


//跑图参数,地图完成测试后以下部分可删除
Instance.ServerCommand("sv_cheat 1");
Instance.ServerCommand("bot_dont_shoot 1");
Instance.ServerCommand("csm_max_num_cascades_override 10"); //CSM阴影绘制槽
Instance.ServerCommand("csm_max_shadow_dist_override 1000"); //CSM阴影绘制距离
Instance.ServerCommand("sv_staminarecoveryrate 1000"); //耐力恢复速度
Instance.ServerCommand("sv_staminajumpcost 0"); //耐力跳跃消耗值
Instance.ServerCommand("sv_staminamax 100"); //耐力值上限 最高100
Instance.ServerCommand("sv_staminalandcost 0"); //耐力值落地消耗值
Instance.ServerCommand("sv_accelerate 100"); //移动加速度
Instance.ServerCommand("sv_stopspeed 250"); //停止运动的速度阈值
Instance.ServerCommand("weapon_accuracy_nospread 1"); //关闭武器弹道的额外扩散
Instance.ServerCommand("sv_disable_radar 1"); //是否禁用雷达
Instance.ServerCommand("mp_freezetime 0"); //取消准备时间
Instance.ServerCommand("mp_roundtime 60"); //回合时间
Instance.ServerCommand("mp_buy_anywhere 1"); //允许在任何位置购买
Instance.ServerCommand("mp_buytime 9999"); //购买时间
Instance.ServerCommand("mp_maxmoney 900000"); //最大金钱
Instance.ServerCommand("mp_startmoney 10000"); //初始金钱
Instance.ServerCommand("sv_falldamage_scale 0"); //摔伤关闭
Instance.ServerCommand("mp_drop_knife_enable 1"); //允许丢刀
Instance.ServerCommand("cs2f_use_old_push 0"); //不修复push
Instance.ServerCommand("mp_maxmoney 99999"); //金钱
Instance.ServerCommand("mp_startmoney 99999"); //金钱
Instance.ServerCommand("mp_ignore_round_win_conditions 1 "); //回合不因死亡结束
Instance.ServerCommand("mp_respawn_on_death_ct 1 "); //回合不因死亡结束
Instance.ServerCommand("mp_respawn_on_death_t 1 "); //回合不因死亡结束
Instance.Msg("----------脚本已加载----------");
//-------------------------------工具函数-----------------------------

//计算两点距离
/**
 * 
 * @param {Vector} start 出发点
 * @param {Vector} end 结束点
 */

function CalculateDistanceBetween(start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return distance;
}
//根据实体视线计算方向向量
/**
 * 
 * @param {QAngle} angle 实体角度
 * 
 */

function CalculateViewtoVector(angles) {
    const pitchRad = angles.pitch * (Math.PI / 180);
    const yawRad = angles.yaw * (Math.PI / 180);
    let x = Math.cos(yawRad) * Math.cos(pitchRad);
    let y = Math.sin(yawRad) * Math.cos(pitchRad);
    let z = -Math.sin(pitchRad);
    return { x: x, y: y, z: z };
}

//计算本体到目标的方向向量,并转化为欧拉角
/**
 * 
 * @param {Vector} self 要设置角度的实体
 * @param {Vector} target 目标实体
 */

function CalculateQangleFromTarget(self, target) {
    const selfpos = self?.GetAbsOrigin();
    const targetpos = target?.GetAbsOrigin();
    const dirVector = { x: targetpos.x - selfpos.x, y: targetpos.y - selfpos.y, z: targetpos.z - selfpos.z };//计算向量
    const xylen = Math.sqrt(dirVector.x * dirVector.x + dirVector.y + dirVector.y);
    let pitch = 0;
    let yaw = 0;
    const roll = 0;
    if (xylen > 0.001) {
        pitch = -Math.atan2(dirVector.z, xylen) * (180 / Math.PI);
    }
    else {
        pitch = dirVector.z > 0 ? -90 : 90;
    }
    yaw = Math.atan2(dirVector.y, dirVector.x) * (180 / Math.PI);
    return { pitch: pitch, yaw: yaw, roll: roll };
}

//向量相加
/**
 * 
 * @param {Vector} vec1 向量1
 * @param {Vector} vec2 向量2
 */
function VectorAdd(vec1, vec2) {
    return { x: vec1.x + vec2.x, y: vec1.y + vec2.y, z: vec1.z + vec2.z };
}

//计算安全的时间延迟
/**
 * 
 * @param {Number} delay 预输入延迟
 * 
 */
function AligntimeToTickrate(delay) {
    const delayTicks = Math.round(delay / Server_tickInterval);
    const aligndelay = delayTicks * Server_tickInterval;
    return aligndelay;
}


//---------------boss类--------------------------
class BossMain {
    /**
     * @param {object} config boss配置
     * @param {Number} config.maxspeed boss最大速度
     * @param {Number} config.health boss基础血量
     * @param {Vector} config.position boss生成位置
     * @param {Object} config.template boss生成模板类
     * @param {Number} config.radius boss最大索敌半径
     * @param {Number} config.rotabase boss转向速度(0,1]越大转向越快
     * @param {Number} config.acceleration boss加速度
     * @param {Number} config.hatred boss仇恨时间
     * @param {Number} config.Buffer boss靠近减速距离
     */
    constructor(config) {
        this.maxspeed = config.maxspeed;
        this.health = config.health;
        this.position = config.position;
        this.template = config.template;
        this.rotabase = config.rotabase;
        this.acceleration = config.acceleration;
        this.hatred = config.hatred;
        this.Buffer = config.Buffer;
        this.hatetime = 0;//动态存储仇恨时间,当到达仇恨时间时自动情况并变换target
        this.velocity = { x: 0, y: 0, z: 0 };//boss速度,Vector
        this.speed = 0;//boss速度,Number
        this.target = null;//boss锁定目标
        this.isActive = false;//boss追踪布尔值
        this.phy = null;//为boss物理实体创建变量
        this.hpbar = null;//为boss血条血量显示创建变量
        this.model = null;//为boss模型创建变量
        this.strafe = false;//boss是否处于加速状态
        this.slow = false;//boss是否处于减速状态
    }
    boss_init() {
        const EntityArray = this.template?.ForceSpawn(this.position);//在目标点位生成模板,并储存模板实体到数组
        for (let raw in EntityArray) {
            if (EntityArray[raw]?.GetEntityName() == boss_phys_targetname && EntityArray[raw]?.IsValid()) { this.phy = EntityArray[raw] };
            if (EntityArray[raw]?.GetEntityName() == boss_hpbar_targetname && EntityArray[raw]?.IsValid()) { this.hpbar = EntityArray[raw] };
            if (EntityArray[raw]?.GetEntityName() == boss_model_targetname && EntityArray[raw]?.IsValid()) { this.model = EntityArray[raw] };
        }
        let TargetArray = Instance.FindEntitiesByClass("player");
        let enemy = [];//筛选符合索敌阵营的玩家
        for (let player in TargetArray) {
            if (TargetArray[player]?.GetTeamNumber() == boss_track_team) { enemy.push(TargetArray[player]) };
        }
        if (enemy.length > 0) {
            this.target = enemy[Math.floor(Math.random() * enemy.length)];//随机锁定一名玩家作为初始目标
            this.health += boss_hp_add * enemy.length;//根据玩家累加血量
            Instance.EntFireAtTarget({ target: this.phy, input: "SetHealth", value: 999999999 });//初始化phybox血量,避免被打爆
            if (boss_track_traget_boolean) { Instance.EntFireAtTarget({ target: this.hpbar, input: "SetMessage", value: "HP:" + this.health + "\n" + this.target?.GetPlayerController()?.GetPlayerName() }) }//初始化hpbar值
            else (Instance.EntFireAtTarget({ target: this.hpbar, input: "SetMessage", value: "HP:" + this.health }));
        }
        else {
            this.isActive = false;
        }
    }
    target_change() {
        if (!this.phy?.IsValid() || this.health == 0 || this.hatetime < this.hatred) return;
        this.hatetime = 0;//重置仇恨时间
        let TargetArray = Instance.FindEntitiesByClass("player");
        let enemy = [];//筛选符合索敌阵营的玩家
        for (let player in TargetArray) {
            if (TargetArray[player]?.GetTeamNumber() == boss_track_team) { enemy.push(TargetArray[player]) };
        }
        if (enemy.length > 0) {
            this.target = enemy[Math.floor(Math.random() * enemy.length)];//随机锁定一名玩家
        }
        else {
            this.isActive = false;//没有符合目标玩家时停止追逐
        }
    }
    dynamic_track() {
        if (!this.isActive || !this.phy?.IsValid() || this.health == 0 || !this.target?.IsValid()) return;
        let angle_pre = CalculateQangleFromTarget(this.phy, this.target);//计算面向目标实体的角度
        angle_pre.pitch = 0;//仅保留水平方向角度
        angle_pre.roll = 0;
        let angle = this.phy?.GetAbsAngles()//获取phy当前角度
        angle.pitch = 0;
        angle.roll = 0;
        if (Math.abs(angle.yaw - angle_pre.yaw) <= 1) this.phy.Teleport({ angles: angle_pre });
        else if (Math.abs(angle.yaw - angle_pre.yaw) > 1 && Math.abs(angle.yaw - angle_pre.yaw) <= 60) {
            angle.yaw - angle_pre.yaw >= 0 ? angle.yaw -= (angle.yaw - angle_pre.yaw) * this.rotabase : angle.yaw += (angle_pre.yaw - angle.yaw) * this.rotabase;
            this.phy.Teleport({ angles: angle });
        }
        else if (Math.abs(angle.yaw - angle_pre.yaw) > 60) {
            this.phy.Teleport({ angles: angle_pre });
        }
        this.velocity = this.phy?.GetAbsVelocity();//获取phy当前速度
        const distance = CalculateDistanceBetween(this.phy?.GetAbsOrigin(), this.target?.GetAbsOrigin());//计算boss与玩家的距离
        if (distance >= 1000) this.strafe = true, this.slow = false;
        else if (distance < 1000 && distance >= this.Buffer) this.strafe = true, this.slow = true;
        else if (distance < this.Buffer && this.speed != 0) this.strafe = false, this.slow = true;
        else if (distance < this.Buffer && this.speed == 0) this.strafe = true, this.slow = true;
        if (this.strafe == true) {
            if (this.slow == true) {
                this.speed += this.acceleration / 2;
                this.speed > this.maxspeed ? this.speed = this.maxspeed : this.speed += 0;
                let speed_vector = CalculateViewtoVector(this.phy?.GetAbsAngles());
                speed_vector.x = speed_vector.x * this.speed;
                speed_vector.y = speed_vector.y * this.speed;
                speed_vector.z = 0;
                this.velocity = VectorAdd(this.velocity, speed_vector);
                const temp_speed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y + this.velocity.z * this.velocity.z);
                if (temp_speed > this.maxspeed) {
                    const scale = this.maxspeed / temp_speed;
                    this.velocity.x = this.velocity.x * scale;
                    this.velocity.y = this.velocity.y * scale;
                    this.velocity.z = 0;
                }
                this.phy.Teleport({ velocity: this.velocity });
                return;
            }
            if (this.slow == false) {
                this.speed += this.acceleration;
                this.speed > this.maxspeed ? this.speed = this.maxspeed : this.speed += 0;
                let speed_vector = CalculateViewtoVector(this.phy?.GetAbsAngles());
                speed_vector.x = speed_vector.x * this.speed;
                speed_vector.y = speed_vector.y * this.speed;
                speed_vector.z = 0;
                this.velocity = VectorAdd(this.velocity, speed_vector);
                const temp_speed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y + this.velocity.z * this.velocity.z);
                if (temp_speed > this.maxspeed) {
                    const scale = this.maxspeed / temp_speed;
                    this.velocity.x = this.velocity.x * scale;
                    this.velocity.y = this.velocity.y * scale;
                    this.velocity.z = 0;
                }
                this.phy.Teleport({ velocity: this.velocity });
                return;
            }
        }
        if (this.strafe == false) {
            if (this.slow == true) {
                this.speed -= this.acceleration;
                this.speed > 0 ? this.speed -= 0 : this.speed = 0;
                let speed_vector = CalculateViewtoVector(this.phy?.GetAbsAngles());
                speed_vector.x = speed_vector.x * this.speed;
                speed_vector.y = speed_vector.y * this.speed;
                speed_vector.z = 0;
                this.velocity = VectorAdd(this.velocity, speed_vector);
                const temp_speed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y + this.velocity.z * this.velocity.z);
                if (temp_speed > this.maxspeed) {
                    const scale = this.maxspeed / temp_speed;
                    this.velocity.x = this.velocity.x * scale;
                    this.velocity.y = this.velocity.y * scale;
                    this.velocity.z = 0;
                }
                this.phy.Teleport({ velocity: this.velocity });
                return;
            }
        }
    }
    boss_statue_check() {
        if (!this.phy?.IsValid() || this.health <= 0) { this.boss_death() };
        if (boss_track_traget_boolean) { Instance.EntFireAtTarget({ target: this.hpbar, input: "SetMessage", value: "HP:" + this.health + "\n" + this.target?.GetPlayerController()?.GetPlayerName() }) }//初始化hpbar值
        else (Instance.EntFireAtTarget({ target: this.hpbar, input: "SetMessage", value: "HP:" + this.health }));
    }
    boss_death() {
        if (!boss_death_animation_boolean) {
            this.isActive = false;
            this.phy.Remove();
            this.hpbar.Remove();
            Queue_pause = true;//终止循环
            return;
        }
        else {
            this.isActive = false;
            this.hpbar.Remove();
            Queue_pause = true;//终止循环
            Instance.EntFireAtTarget({ target: this.model, input: "SetIdleAnimationNotLooping", value: boss_death_animation, delay: boss_death_animation_delay });
            Instance.EntFireAtTarget({ target: this.model, input: "SetAnimationNoResetNotLooping", value: boss_death_animation, delay: boss_death_animation_delay });
        }
    }
}

//-------------------循环类--------------------
class QueueMain {
    constructor() {
        this.delay = AligntimeToTickrate(0.1);
    }
    startthink() {
        Instance.SetThink(() => {
            if (Queue_pause || !deafult_boss.phy?.IsValid()) return;
            deafult_boss.hatetime += 0.1;
            deafult_boss.target_change();
            deafult_boss.dynamic_track();
            deafult_boss.boss_statue_check();
            Instance.SetNextThink(Instance.GetGameTime() + this.delay);
        })
        Instance.SetNextThink(Math.round(Instance.GetGameTime()));
    }
}

let deafult_boss = null;
let Timer = null;
let Queue_pause = false;

//-------------------操作区--------------------

//初始化boss,创建任意实体对脚本输出runscriptinput,参数栏填写script_init
Instance.OnScriptInput("script_init", (inputData) => {
    const template = Instance.FindEntityByName(boss_template_targetname);
    const position = Instance.FindEntityByName(boss_position_targetname)?.GetAbsOrigin();
    config.template = template;
    config.position = position;
    deafult_boss = new BossMain(config);
    Timer = new QueueMain();
    deafult_boss.boss_init();
    Timer.startthink();
    Queue_pause = false;
})

//boss血量减少函数,同上对脚本进行输出,参数栏填写boss_hp_subract
Instance.OnScriptInput("boss_hp_subract", (inputData) => { deafult_boss.health-- });

//强制处死boss,同上对脚本进行输出,参数栏填写boss_death
Instance.OnScriptInput("boss_death", (inputData) => {
    deafult_boss.boss_death();
})

//关闭boss移动,同上对脚本进行输出,参数栏填写boss_freeze
Instance.OnScriptInput("boss_freeze", (inputData) => {
    deafult_boss.isActive = false;
})

//恢复boss移动,同上对脚本进行输出,参数栏填写boss_unfreeze
Instance.OnScriptInput("boss_unfreeze", (inputData) => {
    deafult_boss.isActive = true;
})

Instance.OnRoundEnd((event) => {
    Queue_pause = true;
    deafult_boss = null;
    Timer = null;
})
