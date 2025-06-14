const btcUsdData = [
    { time: "2024-05-11", open: 60793.36, high: 61451.15, low: 60492.63, close: 60793.71 },
    { time: "2024-05-12", open: 60793.50, high: 61818.15, low: 60632.60, close: 61448.39 },
    { time: "2024-05-13", open: 61451.22, high: 63422.66, low: 60769.84, close: 62901.45 },
    { time: "2024-05-14", open: 62900.77, high: 63092.13, low: 61123.77, close: 61552.79 },
    { time: "2024-05-15", open: 61553.99, high: 66454.45, low: 61330.41, close: 66267.49 },
    { time: "2024-05-16", open: 66256.11, high: 66712.43, low: 64613.06, close: 65231.58 },
    { time: "2024-05-17", open: 65231.30, high: 67459.46, low: 65119.31, close: 67051.87 },
    { time: "2024-05-18", open: 67066.21, high: 67387.33, low: 66663.50, close: 66940.80 },
    { time: "2024-05-19", open: 66937.93, high: 67694.30, low: 65937.18, close: 66278.37 },
    { time: "2024-05-20", open: 66278.74, high: 71483.57, low: 66086.17, close: 71448.20 },
    { time: "2024-05-21", open: 71443.06, high: 71946.46, low: 69191.12, close: 70136.53 },
    { time: "2024-05-22", open: 70135.32, high: 70623.69, low: 68977.69, close: 69122.34 },
    { time: "2024-05-23", open: 69121.30, high: 70041.27, low: 66356.95, close: 67929.56 },
    { time: "2024-05-24", open: 67928.13, high: 69220.29, low: 66622.67, close: 68526.10 },
    { time: "2024-05-25", open: 68526.92, high: 69579.32, low: 68515.82, close: 69265.94 },
    { time: "2024-05-26", open: 69264.29, high: 69506.23, low: 68183.89, close: 68518.09 },
    { time: "2024-05-27", open: 68512.18, high: 70597.88, low: 68232.50, close: 69394.55 },
    { time: "2024-05-28", open: 69392.20, high: 69514.64, low: 67227.15, close: 68296.22 },
    { time: "2024-05-29", open: 68296.35, high: 68852.46, low: 67101.49, close: 67578.09 },
    { time: "2024-05-30", open: 67576.09, high: 69500.54, low: 67118.08, close: 68364.99 },
    { time: "2024-05-31", open: 68362.52, high: 68999.57, low: 66633.42, close: 67489.61 },
    { time: "2024-06-01", open: 67475.43, high: 67839.77, low: 67386.20, close: 67706.94 },
    { time: "2024-06-02", open: 67710.27, high: 68409.17, low: 67315.53, close: 67751.60 },
    { time: "2024-06-03", open: 67753.90, high: 70230.82, low: 66252.03, close: 68804.78 },
    { time: "2024-06-04", open: 68804.57, high: 71047.41, low: 68564.64, close: 70567.77 },
    { time: "2024-06-05", open: 70568.35, high: 71735.41, low: 70390.71, close: 71082.82 },
    { time: "2024-06-06", open: 71082.84, high: 71625.74, low: 70119.12, close: 70757.17 },
    { time: "2024-06-07", open: 70759.18, high: 71907.85, low: 68507.26, close: 69342.59 },
    { time: "2024-06-08", open: 69324.18, high: 69533.32, low: 69210.74, close: 69305.77 },
    { time: "2024-06-09", open: 69297.49, high: 69817.52, low: 69160.84, close: 69647.99 },
    { time: "2024-06-10", open: 69644.31, high: 70146.07, low: 69232.43, close: 69512.28 },
    { time: "2024-06-11", open: 69508.08, high: 69549.42, low: 66123.60, close: 67332.03 },
    { time: "2024-06-12", open: 67321.37, high: 69977.89, low: 66902.46, close: 68241.18 },
    { time: "2024-06-13", open: 68243.10, high: 68365.78, low: 66304.57, close: 66756.40 },
    { time: "2024-06-14", open: 66747.57, high: 67294.65, low: 65056.89, close: 66011.09 },
    { time: "2024-06-15", open: 66006.74, high: 66402.19, low: 65871.78, close: 66191.00 },
    { time: "2024-06-16", open: 66189.36, high: 66894.84, low: 66018.25, close: 66639.05 },
    { time: "2024-06-17", open: 66636.52, high: 67188.32, low: 65094.96, close: 66490.29 },
    { time: "2024-06-18", open: 66490.98, high: 66556.70, low: 64066.96, close: 65140.74 },
    { time: "2024-06-19", open: 65146.66, high: 65695.35, low: 64693.30, close: 64960.30 },
    { time: "2024-06-20", open: 64960.30, high: 66438.96, low: 64547.85, close: 64828.66 },
    { time: "2024-06-21", open: 64837.99, high: 65007.55, low: 62785.53, close: 64096.20 },
    { time: "2024-06-22", open: 64113.86, high: 64760.36, low: 63960.03, close: 64252.58 },
    { time: "2024-06-23", open: 64248.96, high: 64491.70, low: 63180.80, close: 63180.80 },
    { time: "2024-06-24", open: 63173.35, high: 63292.53, low: 58601.70, close: 60277.41 },
    { time: "2024-06-25", open: 60266.28, high: 62258.26, low: 60239.75, close: 61804.64 },
    { time: "2024-06-26", open: 61789.68, high: 62434.14, low: 60695.19, close: 60811.28 },
    { time: "2024-06-27", open: 60811.23, high: 62293.86, low: 60585.33, close: 61604.80 },
    { time: "2024-06-28", open: 61612.81, high: 62126.10, low: 59985.40, close: 60320.14 },
    { time: "2024-06-29", open: 60319.87, high: 61097.62, low: 60300.97, close: 60887.38 },
    { time: "2024-06-30", open: 60888.45, high: 62892.83, low: 60632.95, close: 62678.29 },
    { time: "2024-07-01", open: 62673.61, high: 63777.23, low: 62495.51, close: 62851.98 },
    { time: "2024-07-02", open: 62844.41, high: 63203.36, low: 61752.75, close: 62029.02 },
    { time: "2024-07-03", open: 62034.33, high: 62187.70, low: 59419.39, close: 60173.92 },
    { time: "2024-07-04", open: 60147.14, high: 60399.67, low: 56777.80, close: 56977.70 },
    { time: "2024-07-05", open: 57022.81, high: 57497.15, low: 53717.38, close: 56662.37 },
    { time: "2024-07-06", open: 56659.08, high: 58472.55, low: 56038.96, close: 58303.54 },
    { time: "2024-07-07", open: 58239.43, high: 58371.12, low: 55793.33, close: 55849.11 },
    { time: "2024-07-08", open: 55849.57, high: 58131.34, low: 54321.02, close: 56705.10 },
    { time: "2024-07-09", open: 56704.60, high: 58239.20, low: 56316.88, close: 58009.23 },
    { time: "2024-07-10", open: 58033.88, high: 59359.43, low: 57178.41, close: 57742.49 },
    { time: "2024-07-11", open: 57729.89, high: 59299.43, low: 57120.38, close: 57344.91 },
    { time: "2024-07-12", open: 57341.19, high: 58532.55, low: 56590.17, close: 57899.47 },
    { time: "2024-07-13", open: 57908.74, high: 59787.08, low: 57796.44, close: 59231.95 },
    { time: "2024-07-14", open: 59225.25, high: 61329.53, low: 59225.25, close: 60787.79 },
    { time: "2024-07-15", open: 60815.46, high: 64870.15, low: 60704.93, close: 64870.15 },
    { time: "2024-07-16", open: 64784.42, high: 65354.34, low: 62487.97, close: 65097.15 },
    { time: "2024-07-17", open: 65091.83, high: 66066.73, low: 63896.09, close: 64118.79 },
    { time: "2024-07-18", open: 64104.74, high: 65104.66, low: 63246.16, close: 63974.07 },
    { time: "2024-07-19", open: 63972.33, high: 67442.64, low: 63329.34, close: 66710.15 },
    { time: "2024-07-20", open: 66709.93, high: 67610.73, low: 66299.62, close: 67163.64 },
    { time: "2024-07-21", open: 67164.91, high: 68372.91, low: 65842.30, close: 68154.52 },
    { time: "2024-07-22", open: 68152.98, high: 68480.06, low: 66611.30, close: 67585.25 },
    { time: "2024-07-23", open: 67584.80, high: 67779.02, low: 65484.46, close: 65927.67 },
    { time: "2024-07-24", open: 65927.86, high: 67113.98, low: 65146.99, close: 65372.13 },
    { time: "2024-07-25", open: 65375.87, high: 66112.42, low: 63473.47, close: 65777.22 },
    { time: "2024-07-26", open: 65771.81, high: 68207.60, low: 65743.77, close: 67912.06 },
    { time: "2024-07-27", open: 67911.81, high: 69398.51, low: 66705.22, close: 67813.34 },
    { time: "2024-07-28", open: 67808.66, high: 68301.85, low: 67085.83, close: 68255.87 },
    { time: "2024-07-29", open: 68259.05, high: 69987.54, low: 66532.59, close: 66819.92 },
    { time: "2024-07-30", open: 66819.05, high: 66987.67, low: 65323.19, close: 66201.02 },
    { time: "2024-07-31", open: 66201.27, high: 66810.21, low: 64532.05, close: 64619.25 },
    { time: "2024-08-01", open: 64625.84, high: 65593.24, low: 62248.94, close: 65357.50 },
    { time: "2024-08-02", open: 65353.50, high: 65523.22, low: 61184.89, close: 61415.06 },
    { time: "2024-08-03", open: 61414.81, high: 62148.37, low: 59836.53, close: 60680.09 },
    { time: "2024-08-04", open: 60676.09, high: 61062.99, low: 57210.80, close: 58116.98 },
    { time: "2024-08-05", open: 58110.30, high: 58268.83, low: 49121.24, close: 53991.46 },
    { time: "2024-08-06", open: 53991.35, high: 57059.92, low: 53973.27, close: 56034.32 },
    { time: "2024-08-07", open: 56040.63, high: 57726.88, low: 54620.51, close: 55027.46 },
    { time: "2024-08-08", open: 55027.46, high: 62722.23, low: 55024.06, close: 61710.14 },
    { time: "2024-08-09", open: 61728.21, high: 61751.86, low: 59587.86, close: 60880.11 },
    { time: "2024-08-10", open: 60881.23, high: 61464.51, low: 60287.57, close: 60945.81 },
    { time: "2024-08-11", open: 60944.89, high: 61778.66, low: 58348.82, close: 58719.48 },
    { time: "2024-08-12", open: 58719.40, high: 60680.33, low: 57688.90, close: 59354.51 },
    { time: "2024-08-13", open: 59356.21, high: 61572.40, low: 58506.25, close: 60609.57 },
    { time: "2024-08-14", open: 60611.05, high: 61687.76, low: 58472.87, close: 58737.27 },
    { time: "2024-08-15", open: 58733.26, high: 59838.65, low: 56161.59, close: 57560.10 },
    { time: "2024-08-16", open: 57560.27, high: 59847.36, low: 57110.02, close: 58894.10 },
    { time: "2024-08-17", open: 58893.53, high: 59694.67, low: 58814.83, close: 59478.97 },
    { time: "2024-08-18", open: 59468.13, high: 60262.72, low: 58445.40, close: 58483.96 },
    { time: "2024-08-19", open: 58480.71, high: 59612.66, low: 57864.71, close: 59493.45 },
    { time: "2024-08-20", open: 59493.45, high: 61396.33, low: 58610.88, close: 59012.79 },
    { time: "2024-08-21", open: 59014.99, high: 61834.35, low: 58823.44, close: 61175.19 },
    { time: "2024-08-22", open: 61168.32, high: 61408.11, low: 59815.25, close: 60381.91 },
    { time: "2024-08-23", open: 60380.95, high: 64947.06, low: 60372.05, close: 64094.36 },
    { time: "2024-08-24", open: 64103.87, high: 64513.79, low: 63619.92, close: 64178.99 },
    { time: "2024-08-25", open: 64176.37, high: 64996.42, low: 63833.52, close: 64333.54 },
    { time: "2024-08-26", open: 64342.23, high: 64489.71, low: 62849.56, close: 62880.66 },
    { time: "2024-08-27", open: 62879.71, high: 63207.60, low: 58116.75, close: 59504.13 },
    { time: "2024-08-28", open: 59507.92, high: 60236.45, low: 57890.68, close: 59027.63 },
    { time: "2024-08-29", open: 59027.47, high: 61184.08, low: 58786.23, close: 59388.18 },
    { time: "2024-08-30", open: 59388.60, high: 59896.89, low: 57768.53, close: 59119.47 },
    { time: "2024-08-31", open: 59117.48, high: 59432.59, low: 58768.78, close: 58969.90 },
    { time: "2024-09-01", open: 58969.80, high: 59062.07, low: 57217.82, close: 57325.49 },
    { time: "2024-09-02", open: 57326.97, high: 59403.07, low: 57136.03, close: 59112.48 },
    { time: "2024-09-03", open: 59106.19, high: 59815.06, low: 57425.17, close: 57431.02 },
    { time: "2024-09-04", open: 57430.35, high: 58511.57, low: 55673.16, close: 57971.54 },
    { time: "2024-09-05", open: 57971.70, high: 58300.58, low: 55712.45, close: 56160.49 },
    { time: "2024-09-06", open: 56160.19, high: 56976.11, low: 52598.70, close: 53948.75 },
    { time: "2024-09-07", open: 53949.09, high: 54838.15, low: 53740.07, close: 54139.69 },
    { time: "2024-09-08", open: 54147.93, high: 55300.86, low: 53653.76, close: 54841.57 },
    { time: "2024-09-09", open: 54851.89, high: 58041.12, low: 54598.43, close: 57019.53 },
    { time: "2024-09-10", open: 57020.10, high: 58029.98, low: 56419.41, close: 57648.71 },
    { time: "2024-09-11", open: 57650.29, high: 57991.32, low: 55567.34, close: 57343.17 },
    { time: "2024-09-12", open: 57343.17, high: 58534.36, low: 57330.10, close: 58127.01 },
    { time: "2024-09-13", open: 58130.32, high: 60648.02, low: 57650.11, close: 60571.30 },
    { time: "2024-09-14", open: 60569.12, high: 60656.72, low: 59517.88, close: 60005.12 },
    { time: "2024-09-15", open: 60000.73, high: 60381.92, low: 58696.31, close: 59182.84 },
    { time: "2024-09-16", open: 59185.23, high: 59205.51, low: 57501.34, close: 58192.51 },
    { time: "2024-09-17", open: 58192.51, high: 61316.09, low: 57628.07, close: 60308.54 },
    { time: "2024-09-18", open: 60309.00, high: 61664.07, low: 59218.25, close: 61649.68 },
    { time: "2024-09-19", open: 61651.16, high: 63872.44, low: 61609.87, close: 62940.46 },
    { time: "2024-09-20", open: 62941.43, high: 64119.53, low: 62364.61, close: 63192.98 },
    { time: "2024-09-21", open: 63184.34, high: 63543.36, low: 62783.11, close: 63394.84 },
    { time: "2024-09-22", open: 63396.80, high: 63993.42, low: 62440.73, close: 63648.71 },
    { time: "2024-09-23", open: 63643.10, high: 64733.56, low: 62628.08, close: 63329.80 },
    { time: "2024-09-24", open: 63326.84, high: 64695.22, low: 62737.42, close: 64301.97 },
    { time: "2024-09-25", open: 64302.59, high: 64804.50, low: 62945.38, close: 63143.15 },
    { time: "2024-09-26", open: 63138.55, high: 65790.80, low: 62669.27, close: 65181.02 },
    { time: "2024-09-27", open: 65180.67, high: 66480.69, low: 64852.99, close: 65790.66 },
    { time: "2024-09-28", open: 65792.18, high: 66255.53, low: 65458.03, close: 65887.65 },
    { time: "2024-09-29", open: 65888.90, high: 66069.35, low: 65450.01, close: 65635.31 },
    { time: "2024-09-30", open: 65634.66, high: 65635.05, low: 62873.62, close: 63329.50 },
    { time: "2024-10-01", open: 63335.60, high: 64111.00, low: 60189.28, close: 60837.01 },
    { time: "2024-10-02", open: 60836.32, high: 62357.69, low: 59996.95, close: 60632.79 },
    { time: "2024-10-03", open: 60632.49, high: 61469.04, low: 59878.80, close: 60759.40 },
    { time: "2024-10-04", open: 60754.63, high: 62465.99, low: 60459.94, close: 62067.48 },
    { time: "2024-10-05", open: 62067.61, high: 62371.02, low: 61689.58, close: 62089.95 },
    { time: "2024-10-06", open: 62084.99, high: 62959.57, low: 61833.15, close: 62818.95 },
    { time: "2024-10-07", open: 62819.11, high: 64443.71, low: 62152.55, close: 62236.66 },
    { time: "2024-10-08", open: 62221.65, high: 63174.31, low: 61843.56, close: 62131.97 },
    { time: "2024-10-09", open: 62131.73, high: 62508.84, low: 60314.61, close: 60582.10 },
    { time: "2024-10-10", open: 60581.93, high: 61236.72, low: 58895.21, close: 60274.50 },
    { time: "2024-10-11", open: 60275.46, high: 63400.87, low: 60046.13, close: 62445.09 },
    { time: "2024-10-12", open: 62444.62, high: 63448.78, low: 62443.27, close: 63193.02 },
    { time: "2024-10-13", open: 63192.94, high: 63272.65, low: 62035.64, close: 62851.37 },
    { time: "2024-10-14", open: 62848.40, high: 66482.49, low: 62442.15, close: 66046.13 },
    { time: "2024-10-15", open: 66050.37, high: 67881.68, low: 64809.20, close: 67041.11 },
    { time: "2024-10-16", open: 67042.46, high: 68375.29, low: 66758.73, close: 67612.72 },
    { time: "2024-10-17", open: 67617.08, high: 67912.21, low: 66647.39, close: 67399.83 },
    { time: "2024-10-18", open: 67419.11, high: 68969.75, low: 67177.82, close: 68418.79 },
    { time: "2024-10-19", open: 68418.98, high: 68668.01, low: 68024.64, close: 68362.73 },
    { time: "2024-10-20", open: 68364.18, high: 69359.01, low: 68105.72, close: 69001.71 },
    { time: "2024-10-21", open: 69002.00, high: 69462.74, low: 66829.85, close: 67367.85 },
    { time: "2024-10-22", open: 67360.70, high: 67801.58, low: 66581.37, close: 67361.40 },
    { time: "2024-10-23", open: 67362.37, high: 67402.74, low: 65188.04, close: 66432.20 },
    { time: "2024-10-24", open: 66653.70, high: 68798.96, low: 66454.10, close: 68161.05 },
    { time: "2024-10-25", open: 68165.30, high: 68722.16, low: 65521.79, close: 66642.41 },
    { time: "2024-10-26", open: 66628.74, high: 67317.92, low: 66360.60, close: 67014.70 },
    { time: "2024-10-27", open: 67023.48, high: 68221.31, low: 66847.22, close: 67929.30 },
    { time: "2024-10-28", open: 67922.67, high: 70212.27, low: 67535.13, close: 69907.75 },
    { time: "2024-10-29", open: 69910.05, high: 73577.21, low: 69729.92, close: 72720.49 },
    { time: "2024-10-30", open: 72715.37, high: 72905.30, low: 71411.74, close: 72339.54 },
    { time: "2024-10-31", open: 72335.04, high: 72662.31, low: 69590.50, close: 70215.19 },
    { time: "2024-11-01", open: 70216.90, high: 71559.02, low: 68779.70, close: 69482.47 },
    { time: "2024-11-02", open: 69486.02, high: 69867.35, low: 69033.72, close: 69289.28 },
    { time: "2024-11-03", open: 69296.38, high: 69361.66, low: 67482.53, close: 68741.12 },
    { time: "2024-11-04", open: 68742.13, high: 69433.18, low: 66803.65, close: 67811.51 },
    { time: "2024-11-05", open: 67811.17, high: 70522.79, low: 67458.87, close: 69359.57 },
    { time: "2024-11-06", open: 69358.50, high: 76460.15, low: 69322.03, close: 75639.08 },
    { time: "2024-11-07", open: 75637.08, high: 76943.12, low: 74480.42, close: 75904.86 },
    { time: "2024-11-08", open: 75902.83, high: 77252.75, low: 75648.74, close: 76545.48 },
    { time: "2024-11-09", open: 76556.19, high: 76932.76, low: 75773.79, close: 76778.87 },
    { time: "2024-11-10", open: 76775.54, high: 81474.42, low: 76565.43, close: 80474.19 },
    { time: "2024-11-11", open: 80471.41, high: 89604.50, low: 80283.25, close: 88701.49 },
    { time: "2024-11-12", open: 88705.56, high: 89956.88, low: 85155.11, close: 87955.81 },
    { time: "2024-11-13", open: 87929.97, high: 93434.36, low: 86256.93, close: 90584.17 },
    { time: "2024-11-14", open: 90574.88, high: 91765.22, low: 86682.82, close: 87250.43 },
    { time: "2024-11-15", open: 87284.18, high: 91868.74, low: 87124.90, close: 91066.01 },
    { time: "2024-11-16", open: 91064.37, high: 91763.95, low: 90094.23, close: 90558.48 },
    { time: "2024-11-17", open: 90558.46, high: 91433.04, low: 88741.67, close: 89845.85 },
    { time: "2024-11-18", open: 89843.72, high: 92596.79, low: 89393.59, close: 90542.64 },
    { time: "2024-11-19", open: 90536.81, high: 94002.87, low: 90426.99, close: 92343.79 },
    { time: "2024-11-20", open: 92341.89, high: 94902.02, low: 91619.50, close: 94339.50 },
    { time: "2024-11-21", open: 94334.64, high: 99014.21, low: 94132.60, close: 98504.73 },
    { time: "2024-11-22", open: 98496.43, high: 99655.50, low: 97222.67, close: 98997.66 },
    { time: "2024-11-23", open: 99006.74, high: 99014.68, low: 97232.89, close: 97777.28 },
    { time: "2024-11-24", open: 97778.10, high: 98647.18, low: 95788.08, close: 98013.82 },
    { time: "2024-11-25", open: 98033.44, high: 98935.03, low: 92642.91, close: 93102.30 },
    { time: "2024-11-26", open: 93087.28, high: 94991.75, low: 90770.82, close: 91985.32 },
    { time: "2024-11-27", open: 91978.14, high: 97361.18, low: 91778.66, close: 95962.53 },
    { time: "2024-11-28", open: 95954.94, high: 96650.20, low: 94677.35, close: 95652.47 },
    { time: "2024-11-29", open: 95653.95, high: 98693.17, low: 95407.89, close: 97461.52 },
    { time: "2024-11-30", open: 97468.81, high: 97499.34, low: 96144.22, close: 96449.06 },
    { time: "2024-12-01", open: 96461.34, high: 97888.13, low: 95770.18, close: 97279.79 },
    { time: "2024-12-02", open: 97276.01, high: 98152.60, low: 94482.86, close: 95865.30 },
    { time: "2024-12-03", open: 95854.60, high: 96297.20, low: 93629.56, close: 96002.16 },
    { time: "2024-12-04", open: 95988.53, high: 99207.33, low: 94660.52, close: 98768.53 },
    { time: "2024-12-05", open: 98741.54, high: 103900.47, low: 91998.78, close: 96593.57 },
    { time: "2024-12-06", open: 97074.22, high: 102039.88, low: 96514.88, close: 99920.71 },
    { time: "2024-12-07", open: 99916.71, high: 100563.38, low: 99030.89, close: 99923.34 },
    { time: "2024-12-08", open: 99921.92, high: 101399.99, low: 98771.51, close: 101236.01 },
    { time: "2024-12-09", open: 101237.06, high: 101272.50, low: 94355.91, close: 97432.72 },
    { time: "2024-12-10", open: 97441.23, high: 98270.15, low: 94321.26, close: 96675.43 },
    { time: "2024-12-11", open: 96656.06, high: 101913.36, low: 95747.23, close: 101173.03 },
    { time: "2024-12-12", open: 101167.81, high: 102524.91, low: 99339.95, close: 100043.00 },
    { time: "2024-12-13", open: 100046.65, high: 101888.81, low: 99233.28, close: 101459.25 },
    { time: "2024-12-14", open: 101451.44, high: 102618.88, low: 100634.06, close: 101372.97 },
    { time: "2024-12-15", open: 101373.53, high: 105047.54, low: 101227.03, close: 104298.70 },
    { time: "2024-12-16", open: 104293.58, high: 107780.58, low: 103322.98, close: 106029.72 },
    { time: "2024-12-17", open: 106030.69, high: 108268.45, low: 105291.74, close: 106140.60 },
    { time: "2024-12-18", open: 106147.30, high: 106470.61, low: 100041.54, close: 100041.54 },
    { time: "2024-12-19", open: 100070.69, high: 102748.15, low: 95587.68, close: 97490.95 },
    { time: "2024-12-20", open: 97484.70, high: 98098.91, low: 92175.18, close: 97755.93 },
    { time: "2024-12-21", open: 97756.19, high: 99507.10, low: 96426.52, close: 97224.73 },
    { time: "2024-12-22", open: 97218.32, high: 97360.26, low: 94202.19, close: 95104.93 },
    { time: "2024-12-23", open: 95099.39, high: 96416.21, low: 92403.13, close: 94686.24 },
    { time: "2024-12-24", open: 94684.35, high: 99404.06, low: 93448.01, close: 98676.10 },
    { time: "2024-12-25", open: 98675.91, high: 99478.75, low: 97593.47, close: 99299.19 },
    { time: "2024-12-26", open: 99297.70, high: 99884.57, low: 95137.89, close: 95795.52 },
    { time: "2024-12-27", open: 95704.97, high: 97294.85, low: 93310.74, close: 94164.86 },
    { time: "2024-12-28", open: 94160.19, high: 95525.90, low: 94014.29, close: 95163.93 },
    { time: "2024-12-29", open: 95174.06, high: 95174.88, low: 92881.79, close: 93530.23 },
    { time: "2024-12-30", open: 93527.20, high: 94903.32, low: 91317.14, close: 92643.21 },
    { time: "2024-12-31", open: 92643.25, high: 96090.60, low: 91914.03, close: 93429.20 },
    { time: "2025-01-01", open: 93425.10, high: 94929.86, low: 92788.13, close: 94419.76 },
    { time: "2025-01-02", open: 94416.29, high: 97739.82, low: 94201.57, close: 96886.88 },
    { time: "2025-01-03", open: 96881.73, high: 98956.92, low: 96034.61, close: 98107.43 },
    { time: "2025-01-04", open: 98106.99, high: 98734.43, low: 97562.98, close: 98236.23 },
    { time: "2025-01-05", open: 98233.91, high: 98813.31, low: 97291.76, close: 98314.96 },
    { time: "2025-01-06", open: 98314.96, high: 102482.87, low: 97926.15, close: 102078.09 },
    { time: "2025-01-07", open: 102248.85, high: 102712.49, low: 96132.87, close: 96922.71 },
    { time: "2025-01-08", open: 96924.16, high: 97258.32, low: 92525.84, close: 95043.52 },
    { time: "2025-01-09", open: 95043.49, high: 95349.72, low: 91220.84, close: 92484.04 },
    { time: "2025-01-10", open: 92494.49, high: 95770.61, low: 92250.09, close: 94701.46 },
    { time: "2025-01-11", open: 94700.84, high: 94977.69, low: 93840.04, close: 94566.59 },
    { time: "2025-01-12", open: 94565.73, high: 95367.54, low: 93712.51, close: 94488.44 },
    { time: "2025-01-13", open: 94488.89, high: 95837.00, low: 89260.10, close: 94516.53 },
    { time: "2025-01-14", open: 94519.01, high: 97352.66, low: 94322.15, close: 96534.04 },
    { time: "2025-01-15", open: 96534.05, high: 100697.23, low: 96501.64, close: 100504.49 },
    { time: "2025-01-16", open: 100505.30, high: 100781.59, low: 97364.44, close: 99756.91 },
    { time: "2025-01-17", open: 100025.77, high: 105884.23, low: 99948.91, close: 104462.04 },
    { time: "2025-01-18", open: 104124.95, high: 104913.21, low: 102226.62, close: 104408.07 },
    { time: "2025-01-19", open: 104411.29, high: 106299.80, low: 99570.53, close: 101089.61 },
    { time: "2025-01-20", open: 101083.75, high: 109114.88, low: 99471.36, close: 102016.66 },
    { time: "2025-01-21", open: 102052.58, high: 107180.92, low: 100103.96, close: 106146.26 },
    { time: "2025-01-22", open: 106136.38, high: 106294.34, low: 103360.27, close: 103653.07 },
    { time: "2025-01-23", open: 103657.67, high: 106820.33, low: 101257.80, close: 103960.17 },
    { time: "2025-01-24", open: 103965.67, high: 107098.55, low: 102772.12, close: 104819.48 },
    { time: "2025-01-25", open: 104824.03, high: 105243.79, low: 104120.38, close: 104714.65 },
    { time: "2025-01-26", open: 104713.21, high: 105438.64, low: 102507.71, close: 102682.50 },
    { time: "2025-01-27", open: 102680.30, high: 103214.11, low: 97795.94, close: 102087.69 },
    { time: "2025-01-28", open: 102095.42, high: 103730.82, low: 100238.19, close: 101332.48 },
    { time: "2025-01-29", open: 101317.53, high: 104750.81, low: 101283.82, close: 103703.21 },
    { time: "2025-01-30", open: 103709.34, high: 106418.77, low: 103321.65, close: 104735.30 },
    { time: "2025-01-31", open: 104737.56, high: 106026.35, low: 101543.88, close: 102405.03 },
    { time: "2025-02-01", open: 102402.80, high: 102755.73, low: 100297.71, close: 100655.91 },
    { time: "2025-02-02", open: 100661.54, high: 101430.67, low: 96216.08, close: 97688.98 },
    { time: "2025-02-03", open: 97681.10, high: 102514.17, low: 91242.89, close: 101405.42 },
    { time: "2025-02-04", open: 101398.72, high: 101745.61, low: 96208.11, close: 97871.82 },
    { time: "2025-02-05", open: 97878.01, high: 99113.21, low: 96174.83, close: 96615.44 },
    { time: "2025-02-06", open: 96610.64, high: 99168.61, low: 95707.35, close: 96593.30 },
    { time: "2025-02-07", open: 96581.32, high: 100154.14, low: 95653.89, close: 96529.08 },
    { time: "2025-02-08", open: 96533.26, high: 96877.81, low: 95702.49, close: 96482.45 },
    { time: "2025-02-09", open: 96481.32, high: 97325.28, low: 94745.26, close: 96500.09 },
    { time: "2025-02-10", open: 96499.46, high: 98333.22, low: 95320.84, close: 97437.56 },
    { time: "2025-02-11", open: 97438.13, high: 98492.90, low: 94875.04, close: 95747.43 },
    { time: "2025-02-12", open: 95745.69, high: 98151.03, low: 94101.20, close: 97885.86 },
    { time: "2025-02-13", open: 97888.75, high: 98111.09, low: 95269.71, close: 96623.87 },
    { time: "2025-02-14", open: 96623.37, high: 98819.47, low: 96342.81, close: 97508.97 },
    { time: "2025-02-15", open: 97508.38, high: 97975.04, low: 97240.20, close: 97580.35 },
    { time: "2025-02-16", open: 97580.49, high: 97725.60, low: 96060.98, close: 96175.03 },
    { time: "2025-02-17", open: 96179.00, high: 97032.24, low: 95243.54, close: 95773.38 },
    { time: "2025-02-18", open: 95773.82, high: 96695.38, low: 93388.83, close: 95539.54 },
    { time: "2025-02-19", open: 95532.53, high: 96855.60, low: 95011.97, close: 96635.61 },
    { time: "2025-02-20", open: 96632.68, high: 98767.19, low: 96442.67, close: 98333.94 },
    { time: "2025-02-21", open: 98340.67, high: 99497.97, low: 94852.96, close: 96125.54 },
    { time: "2025-02-22", open: 96134.20, high: 96950.16, low: 95765.34, close: 96577.76 },
    { time: "2025-02-23", open: 96577.80, high: 96671.87, low: 95270.45, close: 96273.92 },
    { time: "2025-02-24", open: 96277.96, high: 96503.45, low: 91371.74, close: 91418.17 },
    { time: "2025-02-25", open: 91437.11, high: 92511.08, low: 86008.23, close: 88736.17 },
    { time: "2025-02-26", open: 88638.89, high: 89286.25, low: 82131.90, close: 84347.02 },
    { time: "2025-02-27", open: 84076.86, high: 87000.78, low: 83144.96, close: 84704.22 },
    { time: "2025-02-28", open: 84705.63, high: 85036.32, low: 78248.92, close: 84373.01 },
    { time: "2025-03-01", open: 84373.86, high: 86522.30, low: 83794.23, close: 86031.91 },
    { time: "2025-03-02", open: 86036.26, high: 95043.44, low: 85040.21, close: 94248.35 },
    { time: "2025-03-03", open: 94248.42, high: 94429.75, low: 85081.30, close: 86065.67 },
    { time: "2025-03-04", open: 86064.07, high: 88911.27, low: 81529.24, close: 87222.19 },
    { time: "2025-03-05", open: 87222.95, high: 90998.24, low: 86379.77, close: 90623.56 },
    { time: "2025-03-06", open: 90622.36, high: 92804.94, low: 87852.14, close: 89961.73 },
    { time: "2025-03-07", open: 89963.28, high: 91191.05, low: 84717.68, close: 86742.68 },
    { time: "2025-03-08", open: 86742.65, high: 86847.27, low: 85247.48, close: 86154.59 },
    { time: "2025-03-09", open: 86154.31, high: 86471.13, low: 80052.49, close: 80601.04 },
    { time: "2025-03-10", open: 80597.15, high: 83955.93, low: 77420.59, close: 78532.00 },
    { time: "2025-03-11", open: 78523.87, high: 83577.76, low: 76624.25, close: 82862.21 },
    { time: "2025-03-12", open: 82857.38, high: 84358.58, low: 80635.25, close: 83722.36 },
    { time: "2025-03-13", open: 83724.92, high: 84301.69, low: 79931.85, close: 81066.70 },
    { time: "2025-03-14", open: 81066.99, high: 85263.29, low: 80797.56, close: 83969.10 },
    { time: "2025-03-15", open: 83968.41, high: 84672.67, low: 83639.59, close: 84343.11 },
    { time: "2025-03-16", open: 84333.32, high: 85051.60, low: 82017.90, close: 82579.69 },
    { time: "2025-03-17", open: 82576.33, high: 84725.33, low: 82492.15, close: 84075.69 },
    { time: "2025-03-18", open: 84075.72, high: 84075.72, low: 81179.99, close: 82718.50 },
    { time: "2025-03-19", open: 82718.80, high: 87021.19, low: 82569.73, close: 86854.23 },
    { time: "2025-03-20", open: 86872.95, high: 87443.27, low: 83647.19, close: 84167.19 },
    { time: "2025-03-21", open: 84164.54, high: 84782.27, low: 83171.07, close: 84043.25 },
    { time: "2025-03-22", open: 84046.26, high: 84513.87, low: 83674.78, close: 83832.49 },
    { time: "2025-03-23", open: 83831.90, high: 86094.78, low: 83794.91, close: 86054.37 },
    { time: "2025-03-24", open: 86070.93, high: 88758.73, low: 85541.20, close: 87498.91 },
    { time: "2025-03-25", open: 87512.82, high: 88542.39, low: 86346.08, close: 87471.70 },
    { time: "2025-03-26", open: 87460.24, high: 88292.16, low: 85861.46, close: 86900.89 },
    { time: "2025-03-27", open: 86896.25, high: 87786.72, low: 85837.93, close: 87177.10 },
    { time: "2025-03-28", open: 87185.23, high: 87489.86, low: 83557.64, close: 84353.15 },
    { time: "2025-03-29", open: 84352.07, high: 84567.33, low: 81634.14, close: 82597.58 },
    { time: "2025-03-30", open: 82596.98, high: 83505.00, low: 81573.25, close: 82334.52 },
    { time: "2025-03-31", open: 82336.06, high: 83870.12, low: 81293.89, close: 82548.91 },
    { time: "2025-04-01", open: 82551.92, high: 85487.37, low: 82429.36, close: 85169.17 },
    { time: "2025-04-02", open: 85180.61, high: 88466.96, low: 82343.54, close: 82485.71 },
    { time: "2025-04-03", open: 82487.48, high: 83909.30, low: 81282.10, close: 83102.83 },
    { time: "2025-04-04", open: 83100.25, high: 84696.15, low: 81670.75, close: 83843.80 },
    { time: "2025-04-05", open: 83844.70, high: 84207.02, low: 82377.74, close: 83504.80 },
    { time: "2025-04-06", open: 83504.51, high: 83704.72, low: 77097.74, close: 78214.48 },
    { time: "2025-04-07", open: 78221.33, high: 81119.06, low: 74436.68, close: 79235.33 },
    { time: "2025-04-08", open: 79218.47, high: 80823.89, low: 76198.02, close: 76271.95 },
    { time: "2025-04-09", open: 76273.56, high: 83541.00, low: 74589.67, close: 82573.95 },
    { time: "2025-04-10", open: 82565.97, high: 82700.93, low: 78456.13, close: 79626.14 },
    { time: "2025-04-11", open: 79625.05, high: 84247.47, low: 78936.32, close: 83404.84 },
    { time: "2025-04-12", open: 83404.52, high: 85856.19, low: 82769.38, close: 85287.11 },
    { time: "2025-04-13", open: 85279.47, high: 86015.19, low: 83027.00, close: 83684.98 },
    { time: "2025-04-14", open: 83694.52, high: 85785.00, low: 83690.64, close: 84542.39 },
    { time: "2025-04-15", open: 84539.69, high: 86429.35, low: 83598.82, close: 83668.99 },
    { time: "2025-04-16", open: 83674.51, high: 85428.28, low: 83100.62, close: 84033.87 },
    { time: "2025-04-17", open: 84030.67, high: 85449.07, low: 83749.75, close: 84895.75 },
    { time: "2025-04-18", open: 84900.19, high: 85095.05, low: 84298.88, close: 84450.81 },
    { time: "2025-04-19", open: 84450.87, high: 85597.70, low: 84353.46, close: 85063.41 },
    { time: "2025-04-20", open: 85066.07, high: 85306.38, low: 83976.85, close: 85174.30 },
    { time: "2025-04-21", open: 85171.54, high: 88460.10, low: 85143.84, close: 87518.91 },
    { time: "2025-04-22", open: 87521.87, high: 93817.38, low: 87084.53, close: 93441.89 },
    { time: "2025-04-23", open: 93427.59, high: 94535.73, low: 91962.96, close: 93699.11 },
    { time: "2025-04-24", open: 93692.40, high: 94016.19, low: 91696.71, close: 93943.79 },
    { time: "2025-04-25", open: 93954.25, high: 95768.39, low: 92898.59, close: 94720.50 },
    { time: "2025-04-26", open: 94714.65, high: 95251.36, low: 93927.25, close: 94646.93 },
    { time: "2025-04-27", open: 94660.91, high: 95301.21, low: 93665.40, close: 93754.85 },
    { time: "2025-04-28", open: 93755.30, high: 95598.49, low: 92860.81, close: 94978.75 },
    { time: "2025-04-29", open: 94981.86, high: 95485.41, low: 93796.63, close: 94284.79 },
    { time: "2025-04-30", open: 94286.47, high: 95249.32, low: 92979.64, close: 94207.31 },
    { time: "2025-05-01", open: 94212.86, high: 97437.96, low: 94153.63, close: 96492.34 },
    { time: "2025-05-02", open: 96494.97, high: 97905.90, low: 96375.95, close: 96910.07 },
    { time: "2025-05-03", open: 96904.63, high: 96943.88, low: 95821.29, close: 95891.80 },
    { time: "2025-05-04", open: 95877.18, high: 96318.92, low: 94173.43, close: 94315.97 },
    { time: "2025-05-05", open: 94319.56, high: 95193.19, low: 93566.26, close: 94748.05 },
    { time: "2025-05-06", open: 94748.39, high: 96889.18, low: 93399.86, close: 96802.48 },
    { time: "2025-05-07", open: 96800.19, high: 97625.81, low: 95829.33, close: 97032.32 },
    { time: "2025-05-08", open: 97034.25, high: 103969.54, low: 96913.87, close: 103241.46 },
    { time: "2025-05-09", open: 103239.13, high: 104297.49, low: 102343.09, close: 102970.85 },
    { time: "2025-05-10", open: 102973.71, high: 104961.76, low: 102830.48, close: 104696.33 },
    { time: "2025-05-11", open: 104701.07, high: 104937.99, low: 103364.74, close: 104106.36 },
    { time: "2025-05-12", open: 104106.96, high: 105747.45, low: 100814.40, close: 102812.95 },
    { time: "2025-05-13", open: 102812.49, high: 104997.42, low: 101515.09, close: 104169.81 },
    { time: "2025-05-14", open: 104167.33, high: 104303.57, low: 102618.30, close: 103539.42 },
    { time: "2025-05-15", open: 103538.83, high: 104153.62, low: 101440.81, close: 103744.64 },
    { time: "2025-05-16", open: 103735.66, high: 104533.49, low: 103137.48, close: 103489.29 },
    { time: "2025-05-17", open: 103489.29, high: 103716.95, low: 102659.18, close: 103191.09 },
    { time: "2025-05-18", open: 103186.96, high: 106597.17, low: 103142.60, close: 106446.01 },
    { time: "2025-05-19", open: 106430.53, high: 107068.72, low: 102112.69, close: 105606.18 },
    { time: "2025-05-20", open: 105605.41, high: 107307.11, low: 104206.52, close: 106791.09 },
    { time: "2025-05-21", open: 106791.31, high: 110724.46, low: 106127.23, close: 109678.08 },
    { time: "2025-05-22", open: 109673.49, high: 111970.17, low: 109285.07, close: 111673.28 },
    { time: "2025-05-23", open: 111679.36, high: 111798.90, low: 106841.30, close: 107287.80 },
    { time: "2025-05-24", open: 107278.51, high: 109454.52, low: 106895.29, close: 107791.16 },
    { time: "2025-05-25", open: 107802.27, high: 109313.30, low: 106683.37, close: 109035.39 },
    { time: "2025-05-26", open: 109023.78, high: 110376.88, low: 108735.64, close: 109440.37 },
    { time: "2025-05-27", open: 109440.41, high: 110744.21, low: 107609.56, close: 108994.64 },
    { time: "2025-05-28", open: 108992.17, high: 109298.29, low: 106812.93, close: 107802.32 },
    { time: "2025-05-29", open: 107795.57, high: 108910.05, low: 105374.40, close: 105641.76 },
    { time: "2025-05-30", open: 105646.21, high: 106308.95, low: 103685.79, close: 103998.57 },
    { time: "2025-05-31", open: 103994.72, high: 104927.10, low: 103136.11, close: 104638.09 },
    { time: "2025-06-01", open: 104637.30, high: 105884.54, low: 103826.96, close: 105652.10 },
    { time: "2025-06-02", open: 105649.81, high: 105958.31, low: 103727.55, close: 105881.53 },
    { time: "2025-06-03", open: 105888.47, high: 106813.58, low: 104920.84, close: 105432.47 },
    { time: "2025-06-04", open: 105434.37, high: 105997.69, low: 104232.70, close: 104731.98 },
    { time: "2025-06-05", open: 104750.78, high: 105936.69, low: 100436.89, close: 101575.95 },
    { time: "2025-06-06", open: 101574.37, high: 105376.77, low: 101169.57, close: 104390.35 },
    { time: "2025-06-07", open: 104390.64, high: 105972.75, low: 103987.31, close: 105615.63 },
    { time: "2025-06-08", open: 105617.51, high: 106497.06, low: 105075.33, close: 105793.65 },
    { time: "2025-06-09", open: 105793.02, high: 110561.42, low: 105400.23, close: 110294.10 },
    { time: "2025-06-10", open: 110295.69, high: 110380.12, low: 108367.71, close: 110257.24 },
    { time: "2025-06-11", open: 110261.80, high: 110384.22, low: 108086.33, close: 108686.63 },
    { time: "2025-06-12", open: 108685.91, high: 108780.70, low: 105785.69, close: 105929.05 },
    { time: "2025-06-13", open: 105924.59, high: 106182.55, low: 102822.03, close: 106090.97 }
];