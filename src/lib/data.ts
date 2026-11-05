export type Patient={id:string;name:string;age:number;sex:string;heartRate:number;systolic:number;diastolic:number;lastCheck:string;notes:string};
export const patients:Patient[]=[
{id:"P001",name:"Andi Pratama",age:45,sex:"Laki-laki",heartRate:82,systolic:125,diastolic:80,lastCheck:"02 Nov 2026, 08.30",notes:"Pemantauan rutin"},
{id:"P002",name:"Siti Rahma",age:52,sex:"Perempuan",heartRate:76,systolic:118,diastolic:78,lastCheck:"02 Nov 2026, 09.15",notes:"Kontrol terjadwal"},
{id:"P003",name:"Budi Santoso",age:61,sex:"Laki-laki",heartRate:88,systolic:130,diastolic:85,lastCheck:"02 Nov 2026, 10.00",notes:"Perlu evaluasi berdasarkan catatan dokter"},
{id:"P004",name:"Dina Larasati",age:38,sex:"Perempuan",heartRate:72,systolic:116,diastolic:76,lastCheck:"01 Nov 2026, 13.10",notes:"Pemantauan rutin"},
{id:"P005",name:"Rina Kusuma",age:56,sex:"Perempuan",heartRate:80,systolic:122,diastolic:82,lastCheck:"01 Nov 2026, 08.45",notes:"Kontrol terjadwal"}
];
export const appointments=[{id:1,name:"Andi Pratama",date:"03 Nov 2026",time:"09.00",type:"Konsultasi online"},{id:2,name:"Siti Rahma",date:"03 Nov 2026",time:"11.00",type:"Kontrol rutin"},{id:3,name:"Budi Santoso",date:"04 Nov 2026",time:"14.30",type:"Evaluasi hasil"}];
