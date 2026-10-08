/*
  SKILL TAXONOMY for resume extraction.

  A curated list of skills with the ways a resume writes them. The
  resume parser (resumeParser.js) uses it to find skills in a resume
  and to give each one a single name, so "System Verilog", "SV" and
  "systemverilog" all become "SystemVerilog".

  It is used only while reading a resume (and later when a recruiter
  approves what was read). The rule-based ATS (services/atsService.js)
  does not read it: the ATS still compares skills by exact name. The
  canonical names below are therefore written the way jobs in this
  system spell them ("STA", "CDC", "Place and Route", "Embedded C"), so
  an approved skill meets the job's skill by name.

  Each entry:
    name      the one name the skill is given
    category  a group, for display
    aliases   other spellings, matched without regard to case. A space
              in an alias also matches a hyphen or no space at all, and
              a hyphen matches a space or nothing ("RISC-V", "RISC V",
              "RISCV").
    strict    spellings matched only in exactly this case, anywhere:
              acronyms that are also ordinary words in lower case
              ("ARM", "CAN", "STA").
    listOnly  spellings matched in exactly this case and only inside a
              list of skills (a skills section, a "Tools:" line), never
              in running text: names too short or too common to trust
              in a sentence ("C", "R", "Go", "SV").
  The name itself is always an alias, except where it is listed under
  strict or listOnly.

  A spelling is matched as a whole token: "Verilog" is not found inside
  "SystemVerilog", "Java" not inside "JavaScript" and "C" not inside
  "C++". When spellings overlap, the longest wins.
*/

export const SKILL_CATEGORIES = {
  hdl: 'Hardware languages',
  verification: 'Verification',
  design: 'Digital design',
  physical: 'Physical design',
  dft: 'Design for test',
  analog: 'Analog and mixed-signal',
  eda: 'EDA tools',
  fpga: 'FPGA',
  architecture: 'Processors and architecture',
  protocol: 'Interfaces and protocols',
  embedded: 'Embedded systems',
  safety: 'Automotive and safety',
  programming: 'Programming languages',
  scripting: 'Scripting',
  devtools: 'Software tools',
  rf: 'RF and wireless',
};

const skill = (name, category, { aliases = [], strict = [], listOnly = [], nameIsAlias = true } = {}) => ({
  name,
  category,
  aliases: nameIsAlias ? [name, ...aliases] : aliases,
  strict,
  listOnly,
});

export const SKILLS = [
  // ---- hardware description and verification languages
  skill('SystemVerilog', 'hdl', { aliases: ['System Verilog'], listOnly: ['SV'] }),
  skill('Verilog', 'hdl', { aliases: ['Verilog HDL'] }),
  skill('VHDL', 'hdl'),
  skill('SystemC', 'hdl', { aliases: ['System C'] }),
  skill('Chisel', 'hdl', { nameIsAlias: false, listOnly: ['Chisel'] }),
  skill('HLS', 'hdl', { aliases: ['High Level Synthesis', 'Vivado HLS', 'Catapult HLS'], nameIsAlias: false, strict: ['HLS'] }),

  // ---- verification
  skill('UVM', 'verification', { aliases: ['Universal Verification Methodology'] }),
  skill('OVM', 'verification', { aliases: ['Open Verification Methodology'] }),
  skill('Assertions', 'verification', { aliases: ['SVA', 'SystemVerilog Assertions', 'System Verilog Assertions', 'Assertion Based Verification', 'ABV', 'Concurrent Assertions'], nameIsAlias: false, listOnly: ['Assertions'] }),
  skill('Functional Coverage', 'verification', { aliases: ['Coverage Closure', 'Coverage Driven Verification', 'Covergroups', 'Coverage Analysis'] }),
  skill('Code Coverage', 'verification'),
  skill('Constrained Random Verification', 'verification', { aliases: ['Constrained Random', 'CRV', 'Constrained Random Testing'] }),
  skill('Formal Verification', 'verification', { aliases: ['Formal Property Verification', 'FPV', 'Model Checking'] }),
  skill('Gate Level Simulation', 'verification', { aliases: ['GLS', 'Gate-Level Simulation'] }),
  skill('Design Verification', 'verification', { aliases: ['ASIC Verification', 'SoC Verification', 'IP Verification', 'Functional Verification'], strict: ['DV'] }),
  skill('Testbench Development', 'verification', { aliases: ['Testbench Architecture', 'Test bench Development', 'Testbench Design'] }),
  skill('Emulation', 'verification', { aliases: ['Hardware Emulation', 'Palladium', 'ZeBu', 'Veloce'] }),
  skill('Post-Silicon Validation', 'verification', { aliases: ['Post Silicon Validation', 'Silicon Validation', 'Silicon Bring-up', 'Silicon Bringup', 'Post-Silicon Debug'] }),

  // ---- digital design
  skill('RTL Design', 'design', { aliases: ['RTL Coding', 'RTL Development', 'Register Transfer Level Design', 'RTL Designing'] }),
  skill('Digital Logic Design', 'design', { aliases: ['Digital Design', 'Digital Logic', 'Logic Design', 'Digital Circuit Design'] }),
  skill('Microarchitecture', 'design', { aliases: ['Micro-architecture', 'Micro Architecture'] }),
  skill('CDC', 'design', { aliases: ['Clock Domain Crossing', 'Clock Domain Crossings', 'CDC Analysis'], strict: ['CDC'], nameIsAlias: false }),
  skill('RDC', 'design', { aliases: ['Reset Domain Crossing'], strict: ['RDC'], nameIsAlias: false }),
  skill('Lint', 'design', { aliases: ['Linting', 'RTL Lint', 'Lint Checks'] }),
  skill('Logic Synthesis', 'design', { aliases: ['RTL Synthesis', 'Synthesis'] }),
  skill('Synthesis Constraints', 'design', { aliases: ['SDC', 'Timing Constraints', 'SDC Constraints', 'Design Constraints'] }),
  skill('Low Power Design', 'design', { aliases: ['Low-Power Design', 'Power Aware Design', 'UPF', 'CPF', 'Power Intent', 'Clock Gating', 'Power Gating'] }),
  skill('Logic Equivalence Checking', 'design', { aliases: ['LEC', 'Equivalence Checking', 'Formal Equivalence'] }),
  skill('ASIC Design', 'design', { aliases: ['ASIC Design Flow'] }),
  skill('SoC Design', 'design', { aliases: ['SoC Integration', 'System on Chip'] }),

  // ---- physical design
  skill('Physical Design', 'physical', { aliases: ['Physical Implementation', 'Backend Design', 'RTL to GDSII', 'RTL-to-GDS', 'RTL2GDS'], strict: ['PD'] }),
  skill('Floorplanning', 'physical', { aliases: ['Floor Planning', 'Floorplan', 'Floor-planning'] }),
  skill('Place and Route', 'physical', { aliases: ['Placement and Routing', 'PnR', 'P&R', 'Place & Route', 'Placement & Routing', 'Auto Place and Route'] }),
  skill('Clock Tree Synthesis', 'physical', { aliases: ['CTS'] }),
  skill('STA', 'physical', { aliases: ['Static Timing Analysis'], strict: ['STA'], nameIsAlias: false }),
  skill('Timing Closure', 'physical', { aliases: ['Timing Signoff', 'Timing Sign-off'] }),
  skill('Physical Verification', 'physical', { aliases: ['DRC', 'LVS', 'DRC/LVS', 'Antenna Checks', 'ERC'] }),
  skill('IR Drop Analysis', 'physical', { aliases: ['IR Drop', 'EM/IR', 'EMIR', 'Electromigration', 'Power Integrity'] }),
  skill('Signal Integrity', 'physical', { aliases: ['Crosstalk Analysis'] }),
  skill('Power Analysis', 'physical', { aliases: ['Power Estimation', 'PrimePower', 'Power Signoff'] }),

  // ---- design for test
  skill('DFT', 'dft', { aliases: ['Design for Test', 'Design for Testability', 'Design-for-Test'] }),
  skill('Scan Insertion', 'dft', { aliases: ['Scan Chain Insertion', 'Scan Chains', 'Scan Design', 'Scan Stitching'] }),
  skill('ATPG', 'dft', { aliases: ['Automatic Test Pattern Generation', 'Test Pattern Generation'] }),
  skill('MBIST', 'dft', { aliases: ['Memory BIST', 'Memory Built-in Self Test', 'Memory Built In Self Test'] }),
  skill('LBIST', 'dft', { aliases: ['Logic BIST'] }),
  skill('JTAG', 'dft', { aliases: ['IEEE 1149.1', 'Boundary Scan'] }),

  // ---- analog and mixed-signal
  skill('Analog Design', 'analog', { aliases: ['Analog Circuit Design', 'Analog IC Design', 'Analog Circuits'] }),
  skill('Mixed-Signal Design', 'analog', { aliases: ['Mixed Signal', 'Mixed-Signal', 'AMS', 'Analog Mixed Signal', 'AMS Verification'] }),
  skill('Analog Layout', 'analog', { aliases: ['Custom Layout', 'Layout Design', 'IC Layout', 'Mask Layout'] }),
  skill('SPICE', 'analog', { aliases: ['SPICE Simulation', 'HSPICE', 'Spectre', 'LTspice', 'PSPICE', 'Eldo', 'FineSim'] }),
  skill('PLL', 'analog', { aliases: ['Phase Locked Loop', 'Phase-Locked Loop'], strict: ['PLL'], nameIsAlias: false }),
  skill('ADC', 'analog', { aliases: ['Analog to Digital Converter', 'Analog-to-Digital Converter'], strict: ['ADC'], nameIsAlias: false }),
  skill('DAC', 'analog', { aliases: ['Digital to Analog Converter', 'Digital-to-Analog Converter'], strict: ['DAC'], nameIsAlias: false }),
  skill('LDO', 'analog', { aliases: ['Low Dropout Regulator', 'Low-Dropout Regulator'], strict: ['LDO'], nameIsAlias: false }),
  skill('SerDes', 'analog', { aliases: ['Serializer Deserializer'] }),
  skill('Standard Cell Design', 'analog', { aliases: ['Standard Cell Library', 'Library Characterization', 'Cell Characterization'] }),

  // ---- EDA tools
  skill('VCS', 'eda', { aliases: ['Synopsys VCS'], strict: ['VCS'], nameIsAlias: false }),
  skill('Xcelium', 'eda', { aliases: ['Cadence Xcelium'] }),
  skill('Incisive', 'eda', { aliases: ['NCSim', 'NC-Sim', 'Cadence Incisive'] }),
  skill('Questa', 'eda', { aliases: ['QuestaSim', 'Questa Sim', 'Mentor Questa'] }),
  skill('ModelSim', 'eda', { aliases: ['Model Sim'] }),
  skill('Verdi', 'eda', { aliases: ['Synopsys Verdi', 'DVE', 'SimVision'] }),
  skill('JasperGold', 'eda', { aliases: ['Jasper Gold', 'Jasper'] }),
  skill('SpyGlass', 'eda', { aliases: ['Spy Glass'] }),
  skill('Design Compiler', 'eda', { aliases: ['Synopsys Design Compiler', 'DC Ultra', 'DC Compiler'] }),
  skill('Genus', 'eda', { aliases: ['Cadence Genus', 'RTL Compiler'], strict: ['Genus'], nameIsAlias: false }),
  skill('Innovus', 'eda', { aliases: ['Cadence Innovus', 'Cadence Encounter', 'SoC Encounter'] }),
  skill('IC Compiler', 'eda', { aliases: ['ICC', 'ICC2', 'IC Compiler II', 'ICC II'] }),
  skill('Fusion Compiler', 'eda', { aliases: ['Synopsys Fusion Compiler'] }),
  skill('PrimeTime', 'eda', { aliases: ['Prime Time', 'PrimeTime PX', 'PT-PX'] }),
  skill('Tempus', 'eda', { aliases: ['Cadence Tempus'] }),
  skill('Calibre', 'eda', { aliases: ['Mentor Calibre', 'Siemens Calibre', 'Calibre DRC', 'Calibre LVS'], strict: ['Calibre'], nameIsAlias: false }),
  skill('Conformal', 'eda', { aliases: ['Conformal LEC', 'Cadence Conformal'] }),
  skill('Formality', 'eda', { aliases: ['Synopsys Formality'], strict: ['Formality'], nameIsAlias: false }),
  skill('Virtuoso', 'eda', { aliases: ['Cadence Virtuoso'] }),
  skill('Tessent', 'eda', { aliases: ['Mentor Tessent', 'Siemens Tessent'] }),
  skill('TetraMAX', 'eda', { aliases: ['Tetra MAX', 'TestMAX'] }),
  skill('RedHawk', 'eda', { aliases: ['Ansys RedHawk', 'Red Hawk', 'Voltus'] }),
  skill('StarRC', 'eda', { aliases: ['Star RC', 'Quantus'] }),
  skill('Custom Compiler', 'eda', { aliases: ['Synopsys Custom Compiler'] }),
  skill('ADS', 'eda', { aliases: ['Advanced Design System', 'Keysight ADS'], strict: ['ADS'], nameIsAlias: false }),
  skill('Microwave Office', 'eda', { aliases: ['AWR Microwave Office', 'AWR'] }),
  skill('HFSS', 'eda', { aliases: ['Ansys HFSS'] }),

  // ---- FPGA
  skill('FPGA', 'fpga', { aliases: ['FPGA Design', 'FPGA Development', 'FPGA Prototyping'] }),
  skill('Vivado', 'fpga', { aliases: ['Xilinx Vivado'] }),
  skill('Quartus', 'fpga', { aliases: ['Intel Quartus', 'Altera Quartus', 'Quartus Prime'] }),
  skill('Xilinx ISE', 'fpga', { aliases: ['ISE Design Suite'] }),

  // ---- processors and architecture
  skill('ARM', 'architecture', { aliases: ['ARM Architecture', 'ARM Cortex', 'Cortex-M', 'Cortex-A', 'Cortex-R', 'ARMv8', 'ARMv7'], strict: ['ARM'], nameIsAlias: false }),
  skill('RISC-V', 'architecture', { aliases: ['RISCV', 'RISC V'] }),
  skill('Computer Architecture', 'architecture', { aliases: ['Processor Architecture', 'CPU Architecture', 'Cache Coherency', 'Cache Coherence'] }),
  skill('x86', 'architecture', { aliases: ['x86-64', 'x64'] }),

  // ---- interfaces and protocols
  skill('AMBA', 'protocol', { aliases: ['AMBA Protocols'] }),
  skill('AXI', 'protocol', { aliases: ['AXI4', 'AXI3', 'AXI4-Lite', 'AXI4-Stream', 'AXI Stream'], strict: ['AXI'], nameIsAlias: false }),
  skill('AHB', 'protocol', { strict: ['AHB'], nameIsAlias: false }),
  skill('APB', 'protocol', { strict: ['APB'], nameIsAlias: false }),
  skill('CHI', 'protocol', { aliases: ['AMBA CHI'], strict: ['CHI'], nameIsAlias: false }),
  skill('PCIe', 'protocol', { aliases: ['PCI Express', 'PCI-Express', 'PCIe Gen3', 'PCIe Gen4', 'PCIe Gen5'] }),
  skill('CXL', 'protocol', { aliases: ['Compute Express Link'], strict: ['CXL'], nameIsAlias: false }),
  skill('USB', 'protocol', { aliases: ['USB 2.0', 'USB 3.0', 'USB3', 'USB4'] }),
  skill('Ethernet', 'protocol', { aliases: ['Ethernet MAC', 'Gigabit Ethernet', '10G Ethernet'] }),
  skill('DDR', 'protocol', { aliases: ['DDR3', 'DDR4', 'DDR5', 'LPDDR', 'LPDDR4', 'LPDDR5', 'DDR Memory'] }),
  skill('I2C', 'protocol', { aliases: ['I²C', 'IIC'] }),
  skill('I3C', 'protocol'),
  skill('SPI', 'protocol', { aliases: ['Serial Peripheral Interface'], strict: ['SPI'], nameIsAlias: false }),
  skill('UART', 'protocol', { aliases: ['USART'] }),
  skill('CAN', 'protocol', { aliases: ['CAN bus', 'CAN-FD', 'CAN FD', 'CAN protocol', 'Controller Area Network'], strict: ['CAN'], nameIsAlias: false }),
  skill('LIN', 'protocol', { aliases: ['LIN bus', 'LIN protocol', 'Local Interconnect Network'], strict: ['LIN'], nameIsAlias: false }),
  skill('CAN/LIN', 'protocol', { aliases: ['CAN / LIN', 'CAN and LIN', 'CAN & LIN'], nameIsAlias: true }),
  skill('MIPI', 'protocol', { aliases: ['MIPI CSI', 'MIPI DSI', 'MIPI CSI-2'] }),
  skill('SATA', 'protocol'),
  skill('HDMI', 'protocol'),
  skill('Bluetooth', 'protocol', { aliases: ['BLE', 'Bluetooth Low Energy'] }),
  skill('Wi-Fi', 'protocol', { aliases: ['WiFi', 'WLAN', '802.11'] }),

  // ---- embedded systems
  skill('Embedded C', 'embedded', { aliases: ['Embedded-C', 'Embedded C Programming'] }),
  skill('Embedded Systems', 'embedded', { aliases: ['Embedded System', 'Embedded Software', 'Embedded Firmware'] }),
  skill('Firmware Development', 'embedded', { aliases: ['Firmware', 'Firmware Design', 'Firmware Engineering'] }),
  skill('RTOS', 'embedded', { aliases: ['Real Time Operating System', 'Real-Time Operating Systems', 'Real-Time OS'] }),
  skill('FreeRTOS', 'embedded', { aliases: ['Free RTOS'] }),
  skill('Zephyr', 'embedded', { aliases: ['Zephyr RTOS'] }),
  skill('Embedded Linux', 'embedded'),
  skill('Linux Kernel', 'embedded', { aliases: ['Kernel Programming', 'Linux Kernel Development'] }),
  skill('Device Drivers', 'embedded', { aliases: ['Device Driver', 'Linux Device Drivers', 'Driver Development'] }),
  skill('Bootloader', 'embedded', { aliases: ['Boot Loader', 'U-Boot', 'Bootloaders'] }),
  skill('Yocto', 'embedded', { aliases: ['Yocto Project', 'BitBake'] }),
  skill('Bare Metal Programming', 'embedded', { aliases: ['Bare Metal', 'Bare-metal'] }),
  skill('Microcontrollers', 'embedded', { aliases: ['Microcontroller', 'STM32', 'MSP430', '8051', 'ESP32', 'Arduino', 'PIC Microcontroller', 'AVR Microcontroller'], strict: ['MCU'] }),
  skill('ROS', 'embedded', { aliases: ['Robot Operating System', 'ROS2'], strict: ['ROS'], nameIsAlias: false }),

  // ---- automotive and safety
  skill('AUTOSAR', 'safety', { aliases: ['AUTOSAR Classic', 'AUTOSAR Adaptive'] }),
  skill('ISO 26262', 'safety', { aliases: ['ISO26262'] }),
  skill('Functional Safety', 'safety', { aliases: ['FuSa'] }),
  skill('MISRA C', 'safety', { aliases: ['MISRA', 'MISRA-C', 'MISRA C 2012'] }),
  skill('ASPICE', 'safety', { aliases: ['Automotive SPICE', 'A-SPICE'] }),
  skill('FMEA', 'safety', { aliases: ['FMEDA', 'Failure Mode and Effects Analysis'] }),
  skill('Hazard Analysis', 'safety', { aliases: ['HARA', 'Hazard Analysis and Risk Assessment'] }),

  // ---- programming languages
  skill('C', 'programming', { aliases: ['C Programming', 'C Language', 'ANSI C'], nameIsAlias: false, listOnly: ['C'] }),
  skill('C++', 'programming', { aliases: ['CPP', 'C plus plus', 'Modern C++', 'C++11', 'C++14', 'C++17'] }),
  skill('C#', 'programming', { aliases: ['C Sharp', 'CSharp'] }),
  skill('Python', 'programming', { aliases: ['Python3', 'Python 3'] }),
  skill('Java', 'programming', { aliases: ['Core Java'] }),
  skill('JavaScript', 'programming', { aliases: ['Java Script'], listOnly: ['JS'] }),
  skill('Rust', 'programming', { nameIsAlias: false, listOnly: ['Rust'] }),
  skill('Go', 'programming', { aliases: ['Golang'], nameIsAlias: false, listOnly: ['Go'] }),
  skill('Assembly', 'programming', { aliases: ['Assembly Language', 'Assembly Programming', 'ARM Assembly', 'x86 Assembly'], nameIsAlias: false, listOnly: ['Assembly', 'ASM'] }),
  skill('MATLAB', 'programming', { aliases: ['Simulink', 'MATLAB/Simulink'] }),
  skill('R', 'programming', { aliases: ['R Programming'], nameIsAlias: false, listOnly: ['R'] }),
  skill('SQL', 'programming', { aliases: ['MySQL', 'PostgreSQL'] }),

  // ---- scripting
  skill('Perl', 'scripting', { aliases: ['Perl Scripting'] }),
  skill('Tcl', 'scripting', { aliases: ['TCL Scripting', 'Tcl/Tk'] }),
  skill('Shell Scripting', 'scripting', { aliases: ['Shell Script', 'Bash', 'Bash Scripting', 'csh', 'tcsh', 'Unix Shell'] }),
  skill('Makefile', 'scripting', { aliases: ['Makefiles', 'GNU Make', 'CMake'] }),

  // ---- software tools
  skill('Git', 'devtools', { aliases: ['GitHub', 'GitLab', 'Bitbucket'] }),
  skill('SVN', 'devtools', { aliases: ['Subversion'] }),
  skill('Perforce', 'devtools', { nameIsAlias: false, strict: ['Perforce'] }),
  skill('Jenkins', 'devtools', { aliases: ['Jenkins CI', 'Jenkins Pipeline'], nameIsAlias: false, listOnly: ['Jenkins'] }),
  skill('Docker', 'devtools'),
  skill('Linux', 'devtools', { aliases: ['Unix', 'Linux/Unix', 'Unix/Linux'] }),
  skill('JIRA', 'devtools', { aliases: ['Jira'] }),
  skill('GDB', 'devtools', { aliases: ['GNU Debugger'] }),

  // ---- RF and wireless
  skill('RF Design', 'rf', { aliases: ['RF Circuit Design', 'RFIC Design', 'RF Engineering', 'RFIC'] }),
  skill('Antenna Design', 'rf', { aliases: ['Antenna Engineering'] }),
  skill('Link Budget Analysis', 'rf', { aliases: ['Link Budget'] }),
  skill('Computer Vision', 'programming', { aliases: ['OpenCV'] }),
  skill('Sensor Fusion', 'embedded'),
];

// ------------------------------------------------------------ matching

// The same key the rule-based ATS uses for a skill name (skillKey in
// services/atsService.js): case, spacing and punctuation do not count,
// "+" and "#" do. Kept here so the taxonomy does not import the ATS.
export function skillKey(value) {
  return String(value || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9+#]/g, '');
}

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A spelling as a pattern: a space matches spaces, a hyphen or nothing;
// a hyphen matches a space or nothing.
function spellingPattern(text) {
  return text.trim().split(/([\s-]+)/).map((part) => {
    if (/^\s+$/.test(part)) return '[\\s-]*';
    if (/^-+$/.test(part)) return '[\\s-]?';
    return escape(part);
  }).join('');
}

// A whole token: no letter, digit, "+" or "#" right before or after it.
const BEFORE = '(?<![\\p{L}\\p{N}+#])';
const AFTER = '(?![\\p{L}\\p{N}+#]|\\.[\\p{L}\\p{N}])';

function compile(skills) {
  const patterns = [];
  const byKey = new Map();
  for (const entry of skills) {
    const add = (text, { caseSensitive, listOnly }) => {
      patterns.push({
        skill: entry,
        text,
        listOnly,
        regex: new RegExp(`${BEFORE}${spellingPattern(text)}${AFTER}`, caseSensitive ? 'gu' : 'giu'),
      });
      const key = skillKey(text);
      if (key && !byKey.has(key)) byKey.set(key, entry);
    };
    for (const text of entry.aliases) add(text, { caseSensitive: false, listOnly: false });
    for (const text of entry.strict) add(text, { caseSensitive: true, listOnly: false });
    for (const text of entry.listOnly) add(text, { caseSensitive: true, listOnly: true });
  }
  // The longest spelling first, so "System Verilog Assertions" is taken
  // before "System Verilog", and "Embedded C" before "C".
  patterns.sort((a, b) => b.text.length - a.text.length);
  return { patterns, byKey };
}

/*
  createSkillMatcher - a matcher over the taxonomy, plus `extra` skill
  names (for example the skills the jobs in this system ask for), which
  are matched by their exact name.

  find(text, { list }) - the skills named in a text, in the order they
  first appear: [{ name, category, matched, index }]. `list` says the
  text is a list of skills, where the short list-only spellings count.
  A spelling inside a longer one that was already found is not found
  again.

  normalise(value) - the canonical name of one skill as written, or
  null when the taxonomy does not know it.
*/
export function createSkillMatcher(extra = []) {
  const known = new Set(SKILLS.flatMap((entry) => [...entry.aliases, ...entry.strict, ...entry.listOnly].map(skillKey)));
  const extras = [...new Set(extra.map((name) => String(name || '').trim()).filter((name) => name.length >= 2 && !known.has(skillKey(name))))]
    .map((name) => skill(name, 'job'));
  const { patterns, byKey } = compile([...SKILLS, ...extras]);

  function find(text, { list = false } = {}) {
    let work = String(text || '');
    const found = [];
    for (const pattern of patterns) {
      if (pattern.listOnly && !list) continue;
      pattern.regex.lastIndex = 0;
      const hits = [...work.matchAll(pattern.regex)];
      for (const hit of hits) {
        found.push({ name: pattern.skill.name, category: pattern.skill.category, matched: hit[0], index: hit.index });
        // Blank the span out, so a shorter spelling inside it is not
        // found again ("Verilog" inside "System Verilog").
        work = work.slice(0, hit.index) + ' '.repeat(hit[0].length) + work.slice(hit.index + hit[0].length);
      }
    }
    found.sort((a, b) => a.index - b.index);
    return found;
  }

  function normalise(value) {
    const entry = byKey.get(skillKey(value));
    return entry ? entry.name : null;
  }

  return { find, normalise };
}

const defaultMatcher = createSkillMatcher();

export const findSkills = (text, options) => defaultMatcher.find(text, options);
export const normaliseSkill = (value) => defaultMatcher.normalise(value);

/*
  normaliseSkills - a list of skills as written, each given its
  canonical name when the taxonomy knows it, without repeats (by the
  ATS skill key). A skill the taxonomy does not know is kept as it was
  written. For a recruiter's list at approval time.
*/
export function normaliseSkills(values, matcher = defaultMatcher) {
  const seen = new Set();
  const out = [];
  for (const value of values || []) {
    const written = String(value || '').replace(/\s+/g, ' ').trim();
    if (!written) continue;
    const name = matcher.normalise(written) || written;
    const key = skillKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}
